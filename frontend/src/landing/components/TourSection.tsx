import { useState } from "react"
import {
  ChatScene,
  LibraryScene,
  WorkflowsScene,
  SkillsScene,
  ConnectionsScene,
  SettingsScene,
  OrgScene,
  ControlRoomScene,
} from "../scenes"
import {
  GmailIcon,
  CalendarIcon,
  DriveIcon,
  SlackBrandIcon,
  GithubBrandIcon,
  NotionBrandIcon,
  MicrosoftBrandIcon,
  JiraBrandIcon,
  FigmaBrandIcon,
  LinearBrandIcon,
  SentryBrandIcon,
  IntercomBrandIcon,
  MiroBrandIcon,
  McpBrandIcon,
  GoogleIcon,
} from "./BrandIcons"

type TourTab = "chat" | "library" | "workflows" | "skills" | "connections" | "settings" | "org" | "control"

export function TourSection() {
  const [activeTab, setActiveTab] = useState<TourTab>("chat")

  return (
    <section id="tour" style={{ padding: "0 0 112px", position: "relative", zIndex: 1 }}>
      <div className="wrap">
        <div style={{ maxWidth: 700, marginBottom: 28, display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="eyebrow">Product tour</div>
          <h2
            className="hl h2"
            style={{
              margin: 0,
              fontSize: 40,
              lineHeight: 1.1,
              fontWeight: 700,
              letterSpacing: "-0.02em",
            }}
          >
            Eight surfaces. One continuous system.
          </h2>
          <p style={{ margin: 0, fontSize: 17, lineHeight: 1.55, color: "hsl(220 16% 65%)" }}>
            Explore the real interfaces — how each surface works, what it does for your team, and the
            safeguards built into it.
          </p>
        </div>

        {/* Tab switcher bar */}
        <div
          className="tabbar"
          role="tablist"
          style={{
            display: "flex",
            gap: 6,
            marginBottom: 24,
            overflowX: "auto",
            paddingBottom: 4,
          }}
        >
          {[
            { id: "chat", label: "Chat" },
            { id: "library", label: "Library" },
            { id: "workflows", label: "Workflows" },
            { id: "skills", label: "Skills" },
            { id: "connections", label: "Connections" },
            { id: "settings", label: "Settings" },
            { id: "org", label: "Organization" },
            { id: "control", label: "Control Room" },
          ].map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`tab ${activeTab === tab.id ? "on" : ""}`}
              onClick={() => setActiveTab(tab.id as TourTab)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Chat */}
        {activeTab === "chat" && (
          <div className="card tourpanel">
            <ChatScene />
            <div className="tourgrid">
              <div className="tourleft">
                <div className="eyebrow">Chat</div>
                <h3 className="hl" style={{ margin: 0, fontSize: 28, lineHeight: 1.15, fontWeight: 700, letterSpacing: "-0.02em" }}>
                  The front door. An agent with thirty tools and your documents behind it.
                </h3>
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "hsl(220 16% 65%)" }}>
                  Ask anything. It plans, calls tools, shows each step live in a run card, drops files into the workspace panel beside the conversation, and stops to ask you when it needs a decision. Threads are organised by date or folder, filterable, and every run is kept.
                </p>
                <div className="usefor">
                  <div className="mono usefor-h">USE IT FOR</div>
                  <div>“Summarise every contract in Legal / 2026 and flag auto-renewal clauses.”</div>
                  <div>“Build a pivot of Q3 spend by vendor from the invoices folder as an Excel file.”</div>
                  <div>“Draft the weekly status report from this week’s meeting notes into our template.”</div>
                  <div>“Find free time Thursday, create the event, and draft the invite in Gmail — I’ll approve before it sends.”</div>
                </div>
              </div>
              <div className="tourright">
                <div className="feat"><b>Live run card</b>Every tool call as it happens — step name, model, elapsed time, and a worded failure reason when something breaks.</div>
                <div className="feat"><b>Numbered citations</b>Markers in the answer open the source document at the right page. Confidence is shown, never invented.</div>
                <div className="feat"><b>Workspace panel</b>Files, diffs, todos, versions and the NEEDS YOU card sit beside the chat, not buried in it.</div>
                <div className="feat"><b>Knowledge tools</b>search · query · read · analyze · query tables · query by saved view · related documents · fetch original file.</div>
                <div className="feat"><b>Code and files</b>execute_code in an isolated sandbox · workspace read / write / list / diff / delete · tree · grep · glob.</div>
                <div className="feat"><b>Templates</b>render_template fills your own DOCX or PPTX with real data instead of inventing a layout.</div>
                <div className="feat"><b>Skills and memory</b>load / save / attach skills · remember and recall facts across conversations.</div>
                <div className="feat"><b>Planning</b>write_todos keeps a visible plan; task delegates a sub-job; web_search when the answer isn’t inside.</div>
                <div className="feat"><b>Connector actions</b>Gmail drafts, Calendar events and free-time search, Drive, Docs, Sheets, Contacts, Slack, Jira, SMTP — each behind an approval.</div>
                <div className="feat"><b>Per-conversation model</b>Provider and model pills in the composer. Switch mid-thread; stop, resume, or continue past the iteration cap.</div>
                <div className="feat"><b>Long-run honesty</b>A run-status strip that never vanishes, follow-but-release scrolling, and an active-runs tray for parallel threads.</div>
                <div className="feat"><b>Launch a workflow from chat</b>Published workflows appear as a door in the composer, collecting their declared inputs first.</div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Library */}
        {activeTab === "library" && (
          <div className="card tourpanel">
            <LibraryScene />
            <div className="tourgrid">
              <div className="tourleft">
                <div className="eyebrow">Library</div>
                <h3 className="hl" style={{ margin: 0, fontSize: 28, lineHeight: 1.15, fontWeight: 700, letterSpacing: "-0.02em" }}>
                  Your knowledge base — with the honesty layer most tools skip.
                </h3>
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "hsl(220 16% 65%)" }}>
                  Five tabs: Documents, Views, Ingestion, Indexing, Health. Upload, organise into folders and saved views, see exactly what was extracted from each file, and see what retrieval could not find — so you fix the knowledge base instead of blaming the model.
                </p>
                <div className="usefor">
                  <div className="mono usefor-h">USE IT FOR</div>
                  <div>A policies and SOPs library that answers with the clause, not a paraphrase.</div>
                  <div>A project room: contracts, RFIs, drawings (DXF), invoices and email threads in one searchable place.</div>
                  <div>An Outlook archive: .msg and .eml ingested with their attachments, deduplicated.</div>
                  <div>Finance close: the same folder of invoices queried as a table, every month.</div>
                </div>
              </div>
              <div className="tourright">
                <div className="feat"><b>Formats</b>PDF · DOCX · PPTX · XLSX · CSV · TXT · MD · EPUB, plus Outlook .msg, .eml and CAD .dxf handled server-side.</div>
                <div className="feat"><b>Extraction you can see</b>Text, tables, figures and images per document, with counts on the row and previews in the detail panel.</div>
                <div className="feat"><b>Metadata with confidence</b>Title, date, author, type — each field carries a chip: extracted, medium, low, or manual. Edit inline.</div>
                <div className="feat"><b>Folders and virtual views</b>Real folders plus saved filters (no query language) with relative dates: “invoices, last 90 days, over $50k”.</div>
                <div className="feat"><b>Auto-classification</b>Rules suggest a folder and tags; suggestions are never silently applied — you accept or dismiss.</div>
                <div className="feat"><b>Relationships</b>Link documents (supersedes, references, attachment-of) and browse them grouped by direction.</div>
                <div className="feat"><b>Ingestion tab</b>Queue, progress, failures with reasons, retry. Bulk upload; duplicates detected by content hash.</div>
                <div className="feat"><b>Indexing tab</b>Embedding model, chunking, reranker; re-embed the whole library with a progress card when you change models.</div>
                <div className="feat"><b>Health tab</b>Retrieval analytics: what people asked, what was found, what could not be searched, low-confidence documents to fix.</div>
                <div className="feat"><b>Governance</b>Signal cards with inline fixes — missing metadata, stale documents, unclassified files — the page itself writes nothing.</div>
                <div className="feat"><b>Detail panel</b>Right-side push panel: metadata, extracted tables as data grids, images, relationships, retrieval history.</div>
                <div className="feat"><b>Org-scoped, RLS-enforced</b>Global and org-shared folders are the only shared scope; everything else is yours alone, by database policy.</div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Workflows */}
        {activeTab === "workflows" && (
          <div className="card tourpanel">
            <WorkflowsScene />
            <div className="tourgrid">
              <div className="tourleft">
                <div className="eyebrow">Workflows</div>
                <h3 className="hl" style={{ margin: 0, fontSize: 28, lineHeight: 1.15, fontWeight: 700, letterSpacing: "-0.02em" }}>
                  Recurring work, described once, run on a schedule, proven before it ships.
                </h3>
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "hsl(220 16% 65%)" }}>
                  A library of published workflows, a builder with two doors (describe it, or set every step yourself), a canvas that shows the step spine, a ten-check publish gauntlet, schedules, and a run page where the panel owns the meaningful steps and chat carries a thin receipt.
                </p>
                <div className="usefor">
                  <div className="mono usefor-h">USE IT FOR</div>
                  <div>Weekly team progress report: read this week’s notes, fill the DOCX template, draft the email, pause for review.</div>
                  <div>Invoice triage every morning: new invoices → extract → validate against PO table → post exceptions to Slack.</div>
                  <div>Tender / bid takeoff: read drawings and specs, build the quantities sheet, cite the page for every line.</div>
                  <div>Compliance sweep: scan the contracts folder monthly for renewal dates and create calendar reminders.</div>
                </div>
              </div>
              <div className="tourright">
                <div className="feat"><b>Two doors</b>“How do you want to start?” Describe it in a sentence, or open the editor — both end in the same place.</div>
                <div className="feat"><b>AI first draft</b>The model writes the steps, sets how strict each is, and asks about anything it had to guess. Templates seed the box.</div>
                <div className="feat"><b>Step types</b>Single-model step · agentic step · batch of parallel agents · programmatic step · template fill · validator · human pause · external action.</div>
                <div className="feat"><b>Per-step model and sources</b>Choose the provider per step; restrict which folders it may read; require citations or not.</div>
                <div className="feat"><b>Graded governance</b>A grounding dial per step. Strict mode can be locked, and only the person who locked it can unlock it.</div>
                <div className="feat"><b>Declared inputs</b>Ask for a date range, a customer, a file at launch — from chat, the library card, or the schedule.</div>
                <div className="feat"><b>Services this workflow may use</b>Tick the connections it is allowed; “only what you tick can appear in the draft.”</div>
                <div className="feat"><b>Publish gauntlet</b>Owner · Valid · Goal · Structure · Pause · Grounding · Golden run · Citations · Judge · Commit. Refusals are worded and point at the step.</div>
                <div className="feat"><b>Schedules</b>Cron or interval, with the declared inputs saved; paused schedules say so.</div>
                <div className="feat"><b>Run page</b>Hero, step list with elapsed time, transcript on demand, Stop control, and the approval card when a step needs you.</div>
                <div className="feat"><b>Receipts</b>Every run keeps what ran, what it produced, and where it paused — “paused, waiting on a person”.</div>
                <div className="feat"><b>Library</b>Cards with last-run facts, strict/loose badge, Run, Schedule and Edit doors; filter by owner, status, service.</div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Skills */}
        {activeTab === "skills" && (
          <div className="card tourpanel">
            <SkillsScene />
            <div className="tourgrid">
              <div className="tourleft">
                <div className="eyebrow">Skills</div>
                <h3 className="hl" style={{ margin: 0, fontSize: 28, lineHeight: 1.15, fontWeight: 700, letterSpacing: "-0.02em" }}>
                  Teach it once. It keeps the procedure, versions it, and knows when to use it.
                </h3>
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "hsl(220 16% 65%)" }}>
                  A skill is a written procedure plus optional files and scripts. The agent can create one from a conversation, load one when the request matches, and you can evaluate, tune and version each one in the Skill Studio.
                </p>
                <div className="usefor">
                  <div className="mono usefor-h">USE IT FOR</div>
                  <div>“Our board-deck format” — a PPTX skill that always produces the same 12 slides in house style.</div>
                  <div>“How we quote a roofing job” — the takeoff procedure, the rate sheet, the rounding rules.</div>
                  <div>“Weekly KPI pull” — the exact SQL-like table queries and the chart style.</div>
                  <div>A shared org skill everyone’s agent uses, published only after its evals pass.</div>
                </div>
              </div>
              <div className="tourright">
                <div className="feat"><b>Created in chat</b>Ask the agent to save what it just did as a skill; it authors the procedure against the installed sandbox packages.</div>
                <div className="feat"><b>Files and scripts</b>Attach templates, reference documents and helper scripts; the agent reads them when the skill loads.</div>
                <div className="feat"><b>Skill Studio</b>Three focused tabs — Evals, Triggering, Versions — behind a lifecycle stepper from draft to published.</div>
                <div className="feat"><b>Evals</b>Test cases with an independent judge model, grouped matrix runs across providers, honest run rows you can expand.</div>
                <div className="feat"><b>Trigger Tuner</b>Held-out examples score when the skill should fire; a per-provider scoreboard, lint that warns but never blocks.</div>
                <div className="feat"><b>Versions</b>Immutable version table with compare; roll back without losing history.</div>
                <div className="feat"><b>Publish gate</b>A skill goes org-wide only through a gate dialog that shows what passed and what did not.</div>
                <div className="feat"><b>Scopes</b>Private, org-shared, or system-global — the same one-way RLS door as folders.</div>
                <div className="feat"><b>Community format</b>Reads the open SKILL.md convention, so procedures written elsewhere can be imported.</div>
                <div className="feat"><b>Used by workflows</b>Any step can load a skill, and the gauntlet’s grounding check confirms the skill still resolves.</div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Connections */}
        {activeTab === "connections" && (
          <div className="card tourpanel">
            <ConnectionsScene />
            <div className="tourgrid">
              <div className="tourleft">
                <div className="eyebrow">Connections</div>
                <h3 className="hl" style={{ margin: 0, fontSize: 28, lineHeight: 1.15, fontWeight: 700, letterSpacing: "-0.02em" }}>
                  The tools you already use — granted narrowly, used with permission.
                </h3>
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "hsl(220 16% 65%)" }}>
                  Connect a service once in Settings → Integrations. Each connection carries explicit grants (read calendar, write drafts, never send), and every outbound action still pauses for a person. Any MCP server can be added as a custom connection.
                </p>
                <div className="usefor">
                  <div className="mono usefor-h">USE IT FOR</div>
                  <div>Read a PDF from Drive, summarise it against your policy library, draft the reply in Gmail.</div>
                  <div>Append validated rows to a tracking Sheet at the end of a workflow run.</div>
                  <div>Post the exceptions list to a Slack channel — after you’ve seen it.</div>
                  <div>Create Jira issues from a document review, one per finding, with the citation in the body.</div>
                </div>
              </div>
              <div className="tourright">
                <div className="feat" style={{ gridColumn: "1 / -1" }}>
                  <b>Catalog — as it appears in Settings → Integrations</b>
                  <div className="catgrid">
                    <span><GoogleIcon size={20} />Google Workspace</span>
                    <span><GmailIcon size={20} />Gmail</span>
                    <span><CalendarIcon size={20} />Google Calendar</span>
                    <span><DriveIcon size={20} />Google Drive</span>
                    <span><SlackBrandIcon size={20} />Slack</span>
                    <span><GithubBrandIcon size={20} />GitHub</span>
                    <span><NotionBrandIcon size={20} />Notion</span>
                    <span><MicrosoftBrandIcon size={20} />Microsoft 365</span>
                    <span><JiraBrandIcon size={20} />Jira</span>
                    <span><FigmaBrandIcon size={20} />Figma</span>
                    <span><LinearBrandIcon size={20} />Linear</span>
                    <span><SentryBrandIcon size={20} />Sentry</span>
                    <span><IntercomBrandIcon size={20} />Intercom</span>
                    <span><MiroBrandIcon size={20} />Miro</span>
                    <span><McpBrandIcon size={20} />Any MCP server</span>
                  </div>
                </div>
                <div className="feat"><b>Google Workspace actions</b>Gmail draft · Calendar list / create / update / find free time · Drive create / rename · Docs create / read / append · Sheets read / append / update cells · Contacts.</div>
                <div className="feat"><b>Per-application availability</b>Each connection shows which applications are actually enabled on the provider side, probed live — not assumed.</div>
                <div className="feat"><b>Grants, not blanket access</b>Read and write are separate grants per application; a workflow sees only the services you tick for it.</div>
                <div className="feat"><b>Approval on every write</b>Drafts, posts, events and rows go through the NEEDS YOU card. “Nothing has been sent yet.”</div>
                <div className="feat"><b>OAuth and tokens</b>Sign-in flows for OAuth providers; token status and refusal reasons shown in plain words when something expires.</div>
                <div className="feat"><b>MCP-first</b>Custom servers expose their tools to the workflow builder’s tool picker with reachability checked before publish.</div>
                <div className="feat"><b>Org-scoped</b>Connections belong to an organisation; chat and workflows resolve the right one for the user.</div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 6: Settings */}
        {activeTab === "settings" && (
          <div className="card tourpanel">
            <SettingsScene />
            <div className="tourgrid">
              <div className="tourleft">
                <div className="eyebrow">Settings</div>
                <h3 className="hl" style={{ margin: 0, fontSize: 28, lineHeight: 1.15, fontWeight: 700, letterSpacing: "-0.02em" }}>
                  Models, retrieval, integrations, memory, audit — in the UI, not in a config file.
                </h3>
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "hsl(220 16% 65%)" }}>
                  Five tabs. Everything a user or an admin might tune lives here and takes effect without a redeploy. Secrets stay out of the UI; behaviour lives in it.
                </p>
                <div className="usefor">
                  <div className="mono usefor-h">USE IT FOR</div>
                  <div>Move the whole org to a cheaper default model on Monday, back on Tuesday.</div>
                  <div>Switch retrieval to a local reranker when data must not leave the network.</div>
                  <div>Re-embed the library after changing the embedding model, with a progress card.</div>
                  <div>Show a non-technical user only the settings they should see.</div>
                </div>
              </div>
              <div className="tourright">
                <div className="feat"><b>AI Model</b>Default provider and model, per-role overrides (title generation, judge, embeddings), and the tool-calling mode: Quality, Native, or XML / structured.</div>
                <div className="feat"><b>Retrieval</b>Hybrid search weights, reranking on/off with API (Cohere) or local (sentence-transformers), embedding model with the weight-not-friction re-embed confirm.</div>
                <div className="feat"><b>Integrations</b>The connections list, per-application availability lines, grants, and the custom MCP door.</div>
                <div className="feat"><b>Memory</b>What the agent has remembered about you and your org; edit or forget any of it.</div>
                <div className="feat"><b>Audit Log</b>Your own actions and the agent’s writes on your behalf, filterable, exportable.</div>
                <div className="feat"><b>Provider picker</b>One reusable picker everywhere, single-source provider logos, and the endpoint shown under a lock so you always know where a call goes.</div>
                <div className="feat"><b>Local models</b>LM Studio as a first-class provider with the loaded context window read from the server, not guessed.</div>
                <div className="feat"><b>Engine health</b>A tile board for judge, embeddings and reranker health, and the judge-model knob for evals.</div>
                <div className="feat"><b>Theme</b>Deep Midnight dark and the light variant; the choice persists per user.</div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 7: Org */}
        {activeTab === "org" && (
          <div className="card tourpanel">
            <OrgScene />
            <div className="tourgrid">
              <div className="tourleft">
                <div className="eyebrow">Organization admin</div>
                <h3 className="hl" style={{ margin: 0, fontSize: 28, lineHeight: 1.15, fontWeight: 700, letterSpacing: "-0.02em" }}>
                  Members, roles, invitations, single sign-on, activity.
                </h3>
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "hsl(220 16% 65%)" }}>
                  Built for organisations from the start. Each user can belong to more than one org; each org has its own members, shared folders, shared skills and connections; the database enforces the boundary.
                </p>
                <div className="usefor">
                  <div className="mono usefor-h">USE IT FOR</div>
                  <div>Invite a department, assign roles, and share one knowledge folder org-wide.</div>
                  <div>Enforce SSO for the company domain.</div>
                  <div>See who did what this week without asking IT.</div>
                </div>
              </div>
              <div className="tourright">
                <div className="feat"><b>Members</b>Roster with roles, last-active honesty (unknown says unknown), and remove-with-consequence sheets.</div>
                <div className="feat"><b>Invitations &amp; Roles</b>Email invitations with an accept page; role assignment; pending and expired states.</div>
                <div className="feat"><b>Single sign-on</b>SSO configuration per organisation.</div>
                <div className="feat"><b>Activity</b>An org-level ledger of writes and administrative actions.</div>
                <div className="feat"><b>Org switcher</b>In the profile menu; chat, library and connections follow the active org.</div>
                <div className="feat"><b>Shared scopes</b>Org-shared folders and skills are the only cross-user scope, and the door is one-way by design.</div>
              </div>
            </div>
          </div>
        )}

        {/* Pane: Control Room */}
        {activeTab === "control" && (
          <div className="card tourpanel">
            <ControlRoomScene />
            <div className="tourgrid">
              <div className="tourleft">
                <div className="eyebrow">Control Room</div>
                <h3 className="hl" style={{ margin: 0, fontSize: 28, lineHeight: 1.15, fontWeight: 700, letterSpacing: "-0.02em" }}>
                  The operator’s seat: what is running, what is healthy, what is switched off.
                </h3>
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "hsl(220 16% 65%)" }}>
                  Five tabs behind an operator role: Control Plane, Users &amp; Access, Model Registry, Secrets, Audit log. Every destructive action is guarded in proportion to its blast radius — a victim-naming sheet, an arm-to-confirm, or a direct flip — and every one leaves a receipt.
                </p>
                <div className="usefor">
                  <div className="mono usefor-h">USE IT FOR</div>
                  <div>Kill a runaway run without restarting anything.</div>
                  <div>Turn off outbound connectors org-wide during an incident, with one guarded switch.</div>
                  <div>Register a new model and set what it can do before anyone selects it.</div>
                  <div>Answer “who changed that setting?” from the ledger, with a CSV for the auditor.</div>
                </div>
              </div>
              <div className="tourright">
                <div className="feat"><b>Control Plane</b>Pinned vitals: dependency health (database, Redis, sandbox, providers), active runs with Kill, a kill-switch grid, and spatially separated maintenance actions.</div>
                <div className="feat"><b>Users &amp; Access</b>Roster across orgs, disable with victim-naming, flagged operator grants, feature visibility per audience.</div>
                <div className="feat"><b>Model Registry</b>Every model with provider, capabilities (native tools, structured output, vision, context window) and the emission tier that governs tool-call reliability.</div>
                <div className="feat"><b>Secrets</b>Provider keys and integration secrets, write-only, with rotation receipts.</div>
                <div className="feat"><b>Audit log</b>Two ledgers — operator actions and system writes — chip filters and a recorded CSV export.</div>
                <div className="feat"><b>Technical-names reveal</b>One toggle swaps friendly labels for the identifiers engineers need, everywhere in the room.</div>
                <div className="feat"><b>Feature visibility</b>An API-enforced audience map: what each role sees, with an extensible-audience contract for new roles.</div>
                <div className="feat"><b>Observability</b>LangSmith tracing on every model call; workers, run buffers and Realtime reconciled by fetch, never trusted blindly.</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

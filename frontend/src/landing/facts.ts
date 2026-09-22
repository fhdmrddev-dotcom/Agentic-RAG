/**
 * Phase 226 (SEED-241 / D-226-04 / F-2) — The Living Landing Page Fact Manifest.
 *
 * ── SINGLE SOURCE OF TRUTH ──────────────────────────────────────────────────
 * Every quantitative claim, list, stage name, quote, and capability rendered
 * on the public landing page is exported from this module.
 *
 * ⛔ NEVER HARDCODE NUMBERS IN LANDING JSX.
 * Adding or changing a number or list here without updating the application
 * source will trip `scripts/check-landing-drift.cjs` in the PostToolUse hook
 * and CI.
 */

export interface ProviderFact {
  readonly id: string
  readonly name: string
  readonly badge?: string
}

export interface LocalRuntimeFact {
  readonly id: string
  readonly name: string
  readonly note: string
}

export interface GauntletStageFact {
  readonly label: string
  readonly what: string
}

export interface ConnectorFact {
  readonly id: string
  readonly name: string
  readonly category: "communication" | "developer" | "productivity" | "collaboration" | "custom"
  readonly note?: string
}

export interface VerbatimQuoteFact {
  readonly id: string
  readonly quote: string
  readonly source: string
  readonly attribution: string
}

export interface HeroFacts {
  readonly checksCount: number
  readonly toolsCount: number
  readonly providersCount: number
  readonly localRuntimesCount: number
  readonly citationCoverage: string
}

/**
 * The 8 model providers extracted from MODEL_CAPABILITIES in backend/app/config.py:263-412.
 */
export const MODEL_PROVIDERS: readonly ProviderFact[] = Object.freeze([
  { id: "openai", name: "OpenAI" },
  { id: "anthropic", name: "Anthropic" },
  { id: "google", name: "Google Gemini" },
  { id: "deepseek", name: "DeepSeek" },
  { id: "moonshot", name: "Moonshot AI" },
  { id: "minimax", name: "MiniMax" },
  { id: "zhipu", name: "GLM / Zhipu" },
  { id: "openrouter", name: "OpenRouter" },
])

/**
 * Local model runtimes supported dynamically (_PROVIDER_BASE_URLS minus MODEL_CAPABILITIES).
 */
export const LOCAL_RUNTIMES: readonly LocalRuntimeFact[] = Object.freeze([
  { id: "ollama", name: "Ollama", note: "Run open models locally on your hardware" },
  { id: "lmstudio", name: "LM Studio", note: "Connect local desktop inference server" },
])

/**
 * The 11 ingest formats: 8 dropzone formats from acceptedFormats.ts plus 3 server-side
 * override extensions (.msg, .eml, .dxf from backend/app/api/documents.py:128-130).
 */
// ⚠ RE-SYNCED 2026-09-05. This list had been drifted since 233.1 — the dropzone gained XLS
// and HTML and this file was never updated, so `check-landing-drift.cjs` was already red
// before the images below were added. Both halves are corrected together.
//
// ⚠ THE GUARD'S DOUBLE-COUNT WAS FIXED IN THE SAME COMMIT, and it mattered:
// `FilesSection.tsx` renders one chip per entry with `key={fmt}`, so the `MSG · EML · DXF`
// the guard was demanding twice would have printed twice, under duplicate React keys.
export const INGEST_FORMATS: readonly string[] = Object.freeze([
  "PDF",
  "DOCX",
  "PPTX",
  "XLSX",
  "XLS",
  "CSV",
  "TXT",
  "MD",
  "HTML",
  "EPUB",
  "EML",
  "MSG",
  "DXF",
  "PNG",
  "JPG",
  "JPEG",
  "WEBP",
  "TIFF",
  "BMP",
])

/**
 * Multimodal extraction capabilities for uploaded documents.
 */
export const EXTRACT_CAPABILITIES: readonly string[] = Object.freeze([
  "Text",
  "Tables → data",
  "Figures & images",
  "Metadata + confidence",
  "Email headers",
  "Attachments",
  "Relationships",
])

/**
 * Structured file formats the agent can produce and deliver into the workspace.
 */
export const PRODUCE_FORMATS: readonly string[] = Object.freeze([
  "XLSX",
  "DOCX",
  "PPTX",
  "PDF",
  "CSV",
  "PNG charts",
  "Markdown",
  "HTML",
  "Filled templates",
])

/**
 * The 10 gauntlet stages from PublishGauntlet.tsx:196-207 (STAGES table verbatim).
 */
export const GAUNTLET_STAGES: readonly GauntletStageFact[] = Object.freeze([
  { label: "Owner", what: "Owner check — RLS-resolve + you own it" },
  { label: "Valid", what: "Definition valid — re-validates as a WorkflowDefinition" },
  { label: "Goal", what: "business_requirement — exactly one must be declared" },
  { label: "Structure", what: "Structural lint — reachable · terminal · inputs satisfied · no orphans" },
  { label: "Pause", what: "Interactive-phase check — human-pause phases can't validate synchronously" },
  { label: "Grounding", what: "Grounding check — the folders, tools and skills this workflow points at must all resolve" },
  { label: "Golden run", what: "Golden run — a REAL harness run against the project KB" },
  { label: "Citations", what: "Structural gate — citations / integrity checked during the run" },
  { label: "Judge", what: "Independent judge — an independent model grades the deliverable" },
  { label: "Commit", what: "Publish commit — the draft must not have changed while we were checking it" },
])

/**
 * Built-in tool count from _TOOL_REGISTRY in backend/app/services/tool_dispatcher.py:4202-4238.
 */
export const BUILTIN_TOOL_COUNT = 29

/**
 * Built-in tool groups matching the comment blocks in tool_dispatcher.py.
 */
export const TOOL_GROUPS: readonly { name: string; count: number }[] = Object.freeze([
  { name: "Core & KB navigation", count: 16 },
  { name: "Workspace file operations", count: 5 },
  { name: "Interactive agent tasks", count: 3 },
  { name: "Template rendering", count: 1 },
  { name: "Knowledge view queries", count: 1 },
  { name: "Document relationships", count: 1 },
  { name: "Skill & sandbox attachments", count: 2 },
])

/**
 * The 13 catalog services from CATALOG_SERVICES in servicesCatalog.ts:37-217.
 */
export const CONNECTOR_CATALOG: readonly ConnectorFact[] = Object.freeze([
  { id: "slack", name: "Slack", category: "communication" },
  { id: "github", name: "GitHub", category: "developer" },
  { id: "notion", name: "Notion", category: "productivity" },
  { id: "google", name: "Google Workspace", category: "productivity", note: "Includes Gmail, Calendar, Drive" },
  { id: "microsoft", name: "Microsoft 365", category: "productivity" },
  { id: "jira", name: "Jira", category: "productivity" },
  { id: "smtp", name: "SMTP Email", category: "communication" },
  { id: "custom_mcp", name: "Custom MCP Server", category: "custom" },
  { id: "figma", name: "Figma", category: "productivity" },
  { id: "linear", name: "Linear", category: "developer" },
  { id: "sentry", name: "Sentry", category: "developer" },
  { id: "intercom", name: "Intercom", category: "communication" },
  { id: "miro", name: "Miro", category: "collaboration" },
])

/**
 * Application surface tabs measured from respective page definitions.
 */
export const SURFACE_TABS = Object.freeze({
  library: ["Documents", "Views", "Ingestion", "Indexing", "Health"] as const,
  settings: ["AI Model", "Search & Retrieval", "Integrations", "Memory", "Audit Log"] as const, // admin view; retrieval label is dynamic
  controlRoom: ["Control Plane", "Users & Access", "Model Registry", "Secrets", "Audit log"] as const,
  orgAdmin: ["Members", "Experts", "Audit", "Settings", "Invitations & Roles", "SSO", "Subscription", "Retention"] as const,
})

/**
 * Verbatim product quotes asserted against shipped vocabulary and component files.
 */
export const VERBATIM_QUOTES: readonly VerbatimQuoteFact[] = Object.freeze([
  {
    id: "ask_paused",
    quote: "Paused — waiting for you.",
    source: "frontend/src/components/workflows/stepIdentityVocabulary.ts",
    attribution: "Human-in-the-loop approval pause",
  },
  {
    id: "ask_nothing_sent",
    quote: "Nothing has been sent yet.",
    source: "frontend/src/components/workflows/stepIdentityVocabulary.ts",
    attribution: "External action guarantee",
  },
  {
    id: "describe_door",
    quote: "Describe the recurring work in plain language. The AI writes the steps, sets how strict it is, and asks you about anything it had to guess.",
    source: "frontend/src/components/workflows/doorVocabulary.ts",
    attribution: "Workflow Studio Describe Door",
  },
  {
    id: "golden_run",
    quote: "Golden run — a REAL harness run against the project KB",
    source: "frontend/src/components/workflows/PublishGauntlet.tsx",
    attribution: "Publish Gauntlet Stage 7",
  },
  {
    id: "independent_judge",
    quote: "Independent judge — an independent model grades the deliverable",
    source: "frontend/src/components/workflows/PublishGauntlet.tsx",
    attribution: "Publish Gauntlet Stage 9",
  },
  {
    id: "reason_unknown",
    quote: "Failure reason not captured by the backend — surfaced explicitly so the run is never shown as an empty success.",
    source: "frontend/src/components/workflows/stepIdentityVocabulary.ts",
    attribution: "Run failure honesty sentinel",
  },
])

/**
 * Derived hero facts and headline metrics.
 */
export const HERO_FACTS: HeroFacts = Object.freeze({
  checksCount: GAUNTLET_STAGES.length, // 10
  toolsCount: BUILTIN_TOOL_COUNT, // 29
  providersCount: MODEL_PROVIDERS.length, // 8
  localRuntimesCount: LOCAL_RUNTIMES.length, // 2
  citationCoverage: "100%", // citation gate enforced by gauntlet
})

/**
 * Comparison criteria across category types (no named competitor trademarks).
 */
export type CompareScore = "full" | "part" | "none"

export interface CategoryComparisonRow {
  readonly capability: string
  readonly agenticRag: CompareScore
  readonly chatAssistant: CompareScore
  readonly enterpriseSearch: CompareScore
  readonly workflowPlatform: CompareScore
  readonly inHouseBuild: CompareScore
  readonly note: string
}

export const CATEGORY_COMPARISON: readonly CategoryComparisonRow[] = Object.freeze([
  {
    capability: "Strict document citations with line-level grounding",
    agenticRag: "full",
    chatAssistant: "part",
    enterpriseSearch: "full",
    workflowPlatform: "none",
    inHouseBuild: "part",
    note: "Every claim points directly to indexed source chunks.",
  },
  {
    capability: "Real file production (XLSX, DOCX, PPTX, PDF)",
    agenticRag: "full",
    chatAssistant: "part",
    enterpriseSearch: "none",
    workflowPlatform: "part",
    inHouseBuild: "part",
    note: "Sandboxed execution produces valid OOXML spreadsheets and reports.",
  },
  {
    capability: "Deterministic 10-stage publish gauntlet before automation",
    agenticRag: "full",
    chatAssistant: "none",
    enterpriseSearch: "none",
    workflowPlatform: "none",
    inHouseBuild: "none",
    note: "Independent judge model and golden test runs verify every workflow.",
  },
  {
    capability: "Human-in-the-loop pause before external side-effects",
    agenticRag: "full",
    chatAssistant: "none",
    enterpriseSearch: "none",
    workflowPlatform: "part",
    inHouseBuild: "part",
    note: "Agent halts and requests explicit confirmation before dispatching actions.",
  },
  {
    capability: "Zero lock-in multi-model independence (8 providers + local)",
    agenticRag: "full",
    chatAssistant: "none",
    enterpriseSearch: "part",
    workflowPlatform: "part",
    inHouseBuild: "full",
    note: "Switch between OpenAI, Anthropic, Gemini, DeepSeek, and local Ollama freely.",
  },
  {
    capability: "Sandboxed Python & Bash code execution",
    agenticRag: "full",
    chatAssistant: "part",
    enterpriseSearch: "none",
    workflowPlatform: "part",
    inHouseBuild: "part",
    note: "Dedicated ephemeral containers isolate all code execution.",
  },
  {
    capability: "Universal MCP connector discovery and tool authorization",
    agenticRag: "full",
    chatAssistant: "none",
    enterpriseSearch: "none",
    workflowPlatform: "none",
    inHouseBuild: "part",
    note: "Standard Model Context Protocol client with granular egress controls.",
  },
  {
    capability: "Tamper-evident audit ledger and row-level tenant security",
    agenticRag: "full",
    chatAssistant: "none",
    enterpriseSearch: "part",
    workflowPlatform: "part",
    inHouseBuild: "part",
    note: "Full platform actions, tool calls, and model decisions immutably recorded.",
  },
])

/**
 * 30-row full picture comparison matrix.
 */
export const FULL_COMPARISON_MATRIX: readonly CategoryComparisonRow[] = Object.freeze([
  ...CATEGORY_COMPARISON,
  {
    capability: "Hybrid semantic vector + BM25 full-text keyword retrieval",
    agenticRag: "full",
    chatAssistant: "none",
    enterpriseSearch: "full",
    workflowPlatform: "none",
    inHouseBuild: "part",
    note: "Dual-engine indexing ensures precision on technical codes and semantics.",
  },
  {
    capability: "Multimodal table and image extraction pipeline",
    agenticRag: "full",
    chatAssistant: "part",
    enterpriseSearch: "part",
    workflowPlatform: "none",
    inHouseBuild: "part",
    note: "Preserves tabular structure and relationships rather than flattening.",
  },
  {
    capability: "Self-correcting iterative reflection before answering",
    agenticRag: "full",
    chatAssistant: "part",
    enterpriseSearch: "none",
    workflowPlatform: "none",
    inHouseBuild: "part",
    note: "Multi-turn planning agent validates deliverables against goals.",
  },
  {
    capability: "Extensible teachable skills persisted across conversations",
    agenticRag: "full",
    chatAssistant: "none",
    enterpriseSearch: "none",
    workflowPlatform: "none",
    inHouseBuild: "part",
    note: "Custom organizational instructions, formulas, and rubrics saved as skills.",
  },
  {
    capability: "Egress firewall preventing SSRF and internal network scanning",
    agenticRag: "full",
    chatAssistant: "none",
    enterpriseSearch: "none",
    workflowPlatform: "none",
    inHouseBuild: "part",
    note: "Blocks RFC1918 private subnets and cloud metadata endpoints by default.",
  },
  {
    capability: "PostgreSQL Row-Level Security (RLS) on all tenant tables",
    agenticRag: "full",
    chatAssistant: "none",
    enterpriseSearch: "part",
    workflowPlatform: "none",
    inHouseBuild: "part",
    note: "Hard database-level partition guarantees cross-tenant isolation.",
  },
  {
    capability: "Air-gapped and self-hosted on-premises deployment option",
    agenticRag: "full",
    chatAssistant: "none",
    enterpriseSearch: "part",
    workflowPlatform: "part",
    inHouseBuild: "full",
    note: "Single Docker Compose stack connects to local hardware inference.",
  },
  {
    capability: "Natural language workflow authoring (Describe door)",
    agenticRag: "full",
    chatAssistant: "none",
    enterpriseSearch: "none",
    workflowPlatform: "part",
    inHouseBuild: "none",
    note: "AI drafts node graphs, parameters, and assertions from plain text.",
  },
  {
    capability: "Visual workflow canvas with step-level input/output mapping",
    agenticRag: "full",
    chatAssistant: "none",
    enterpriseSearch: "none",
    workflowPlatform: "full",
    inHouseBuild: "none",
    note: "Fine-tune and inspect every node link and conditional branch visually.",
  },
  {
    capability: "Automated recurring cron and interval workflow execution",
    agenticRag: "full",
    chatAssistant: "none",
    enterpriseSearch: "none",
    workflowPlatform: "full",
    inHouseBuild: "part",
    note: "Reliable background scheduler executes without active browser sessions.",
  },
  {
    capability: "Per-run execution token and compute duration spend caps",
    agenticRag: "full",
    chatAssistant: "none",
    enterpriseSearch: "none",
    workflowPlatform: "part",
    inHouseBuild: "part",
    note: "Hard limits protect against run-away loops and unexpected provider bills.",
  },
  {
    capability: "Live step-by-step progress and thought stream visibility",
    agenticRag: "full",
    chatAssistant: "part",
    enterpriseSearch: "none",
    workflowPlatform: "part",
    inHouseBuild: "part",
    note: "Complete transparency into which tool is executing and why.",
  },
  {
    capability: "Emergency kill-switch controls on active background runs",
    agenticRag: "full",
    chatAssistant: "none",
    enterpriseSearch: "none",
    workflowPlatform: "full",
    inHouseBuild: "part",
    note: "Instantly abort running tasks from chat or operator control room.",
  },
  {
    capability: "Granular per-tool access grants for third-party integrations",
    agenticRag: "full",
    chatAssistant: "none",
    enterpriseSearch: "none",
    workflowPlatform: "part",
    inHouseBuild: "part",
    note: "Grant read-only access without exposing dangerous write capabilities.",
  },
  {
    capability: "Write-only encrypted secret storage with zero client exposure",
    agenticRag: "full",
    chatAssistant: "none",
    enterpriseSearch: "none",
    workflowPlatform: "full",
    inHouseBuild: "full",
    note: "Fernet key encryption prevents plain-text API keys from leaving backend.",
  },
  {
    capability: "Enterprise SAML 2.0 / SSO single sign-on integration",
    agenticRag: "full",
    chatAssistant: "none",
    enterpriseSearch: "full",
    workflowPlatform: "full",
    inHouseBuild: "part",
    note: "Integrate with Okta, Azure AD, or Google Identity with role mapping.",
  },
  {
    capability: "Dynamic backpressure and infrastructure vitals telemetry",
    agenticRag: "full",
    chatAssistant: "none",
    enterpriseSearch: "none",
    workflowPlatform: "part",
    inHouseBuild: "part",
    note: "Real-time health monitoring of database, Redis, workers, and sandboxes.",
  },
  {
    capability: "Multi-organization workspace switching under one account",
    agenticRag: "full",
    chatAssistant: "part",
    enterpriseSearch: "part",
    workflowPlatform: "part",
    inHouseBuild: "part",
    note: "Seamlessly switch between team workspaces without logging out.",
  },
  {
    capability: "Granular RBAC role delegation (Owner, Admin, Member)",
    agenticRag: "full",
    chatAssistant: "none",
    enterpriseSearch: "full",
    workflowPlatform: "full",
    inHouseBuild: "part",
    note: "Role-based controls manage who can edit settings, invite users, or view logs.",
  },
  {
    capability: "Zero training data retention guarantee on private corporate data",
    agenticRag: "full",
    chatAssistant: "part",
    enterpriseSearch: "full",
    workflowPlatform: "full",
    inHouseBuild: "full",
    note: "API tier enterprise contracts ensure your documents are never used for training.",
  },
  {
    capability: "CSV, JSON, and PDF audit ledger export for security compliance",
    agenticRag: "full",
    chatAssistant: "none",
    enterpriseSearch: "part",
    workflowPlatform: "full",
    inHouseBuild: "part",
    note: "Download complete compliance reports for SOC2 and security reviews.",
  },
  {
    capability: "Offline-first resilient local file dropzone and preview",
    agenticRag: "full",
    chatAssistant: "part",
    enterpriseSearch: "none",
    workflowPlatform: "none",
    inHouseBuild: "part",
    note: "Drag and drop complex documents with immediate syntax preview.",
  },
])

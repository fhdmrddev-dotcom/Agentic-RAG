/**
 * Phase 212 (CAT-01 / CAT-02 / D-211-02) — Presentation Catalog of Services.
 *
 * Authored registry of known services keyed on `service_id`. Adding a new service
 * to the presentation catalog is pure frontend and requires zero database migrations.
 */

export type ServiceCategory = "collaboration" | "productivity" | "developer" | "communication" | "custom"

export interface ServiceFieldTemplate {
  key: string
  label: string
  type: "text" | "password" | "url"
  placeholder: string
  helpText: string
  required: boolean
}

export interface CatalogServiceEntry {
  serviceId: string
  name: string
  tagline: string
  description: string
  markKey: string
  isPopular: boolean
  category: ServiceCategory
  defaultHost?: string
  fieldTemplates?: ServiceFieldTemplate[]
  starterPrompts?: string[]
}

export const POPULAR_SERVICES: CatalogServiceEntry[] = [
  {
    serviceId: "slack",
    name: "Slack",
    tagline: "Post updates and read channels in your workspace.",
    description: "Connect to Slack channels to post notifications, broadcast run summaries, and keep teams updated in real-time.",
    markKey: "slack",
    isPopular: true,
    category: "communication",
    defaultHost: "hooks.slack.com",
    starterPrompts: [
      "Post daily incident summaries to #alerts",
      "Broadcast critical build status updates",
    ],
  },
  {
    serviceId: "github",
    name: "GitHub",
    tagline: "Track code changes and manage pull requests.",
    description: "Integrate with GitHub to inspect pull requests, manage issues, and trigger actions through MCP.",
    markKey: "mcp",
    isPopular: true,
    category: "developer",
    defaultHost: "api.github.com",
    starterPrompts: [
      "Query open pull requests for review",
      "Search repository commits for regression analysis",
    ],
  },
  {
    serviceId: "notion",
    name: "Notion",
    tagline: "Organise notes and collaborate on documents.",
    description: "Query Notion pages, sync documentation databases, and append notes to engineering wikis.",
    markKey: "mcp",
    isPopular: true,
    category: "productivity",
    defaultHost: "api.notion.com",
    starterPrompts: [
      "Search engineering runbooks and SOPs",
      "Append retrospective notes to project board",
    ],
  },
  {
    serviceId: "jira",
    name: "Jira",
    tagline: "Raise and track issues for your team.",
    description: "Create and track agile issues, update sprint statuses, and attach bug reports directly from agent workflows.",
    markKey: "jira",
    isPopular: true,
    category: "productivity",
    defaultHost: "acme.atlassian.net",
    starterPrompts: [
      "Raise a high-priority bug ticket with error logs",
      "Summarize open sprint issues for standup",
    ],
  },
  {
    serviceId: "smtp",
    name: "Email (SMTP)",
    tagline: "Direct outbound notifications via standard mail servers.",
    description: "Send formatted emails and incident reports directly using your organization's SMTP relay or transactional email provider.",
    markKey: "smtp",
    isPopular: true,
    category: "communication",
    defaultHost: "smtp.fastmail.com",
    starterPrompts: [
      "Email executive summary to stakeholders",
      "Send alert notifications on workflow failure",
    ],
  },
  {
    serviceId: "google",
    name: "Google Workspace",
    tagline: "Document collaboration and drive assets.",
    description: "Access shared Google Drive files, search documents, and read team collaboration resources.",
    markKey: "mcp",
    isPopular: true,
    category: "productivity",
    defaultHost: "googleapis.com",
    starterPrompts: [
      "Summarize shared team documentation",
      "Search team drive for architectural specs",
    ],
  },
  {
    serviceId: "custom_mcp",
    name: "Custom MCP Server",
    tagline: "Connect any Model Context Protocol compliant server.",
    description: "Paste the URL of any remote MCP server to discover and grant its published tools with egress safety.",
    markKey: "mcp",
    isPopular: true,
    category: "custom",
    defaultHost: "mcp.internal.server",
    starterPrompts: [
      "Discover published tools from enterprise servers",
      "Connect private domain MCP endpoints",
    ],
  },
]

export const CATALOG_SERVICES: CatalogServiceEntry[] = [
  ...POPULAR_SERVICES,
  {
    serviceId: "figma",
    name: "Figma",
    tagline: "Design interfaces and prototype user flows.",
    description: "Access Figma files, inspect design components, and sync assets across product and design workflows.",
    markKey: "mcp",
    isPopular: false,
    category: "productivity",
    defaultHost: "api.figma.com",
  },
  {
    serviceId: "linear",
    name: "Linear",
    tagline: "Plan projects and manage developer workflows.",
    description: "Sync development issues, manage sprint cycles, and track project roadmap milestones with Linear.",
    markKey: "mcp",
    isPopular: false,
    category: "developer",
    defaultHost: "api.linear.app",
  },
  {
    serviceId: "sentry",
    name: "Sentry",
    tagline: "Monitor errors and watch releases.",
    description: "Query crash reports, monitor exception trends, and inspect release health across application services.",
    markKey: "mcp",
    isPopular: false,
    category: "developer",
    defaultHost: "sentry.io",
  },
  {
    serviceId: "intercom",
    name: "Intercom",
    tagline: "Chat with customers and manage support tickets.",
    description: "Search customer support conversations, retrieve user feedback, and manage customer communications.",
    markKey: "mcp",
    isPopular: false,
    category: "communication",
    defaultHost: "api.intercom.io",
  },
  {
    serviceId: "miro",
    name: "Miro",
    tagline: "Sketch ideas on a shared whiteboard.",
    description: "Collaborate visually on architecture diagrams, journey maps, and real-time team whiteboards.",
    markKey: "mcp",
    isPopular: false,
    category: "collaboration",
    defaultHost: "api.miro.com",
  },
]

const SERVICES_BY_ID = new Map<string, CatalogServiceEntry>(
  CATALOG_SERVICES.map((entry) => [entry.serviceId.toLowerCase(), entry]),
)

/**
 * Total lookup over any serviceId. Never throws and never returns null.
 */
export function getServiceCatalogEntry(serviceId: string | null | undefined): CatalogServiceEntry {
  const normalized = (serviceId || "").trim().toLowerCase()
  if (normalized && SERVICES_BY_ID.has(normalized)) {
    return SERVICES_BY_ID.get(normalized)!
  }

  // Graceful dynamic fallback for uncurated services or hostname service_ids (e.g. mcp.deepwiki.com)
  const name = serviceId?.trim() || "Custom Service"
  return {
    serviceId: serviceId?.trim() || "unknown",
    name,
    tagline: "Connected MCP service",
    description: `Configured connector for ${name}`,
    markKey: "mcp",
    isPopular: false,
    category: "custom",
  }
}

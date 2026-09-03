import { CONNECTOR_CATALOG } from "../facts"
import { getServiceIcon } from "./BrandIcons"

const SERVICE_DESCRIPTIONS: Record<string, { name?: string; desc: string }> = {
  google: {
    name: "Google Workspace",
    desc: "Gmail drafts · Calendar · Drive · Docs · Sheets · Contacts",
  },
  slack: {
    desc: "Post summaries and exceptions to a channel",
  },
  jira: {
    desc: "One issue per finding, citation in the body",
  },
  github: {
    desc: "Issues and repositories as sources and targets",
  },
  notion: {
    desc: "Pages and databases",
  },
  microsoft: {
    desc: "Teams, Outlook, SharePoint files",
  },
  figma: {
    desc: "Design files as context",
  },
  linear: {
    desc: "Issues and cycles",
  },
  sentry: {
    desc: "Errors and releases",
  },
  intercom: {
    desc: "Conversations and customers",
  },
  miro: {
    desc: "Boards",
  },
  mcp: {
    name: "Any MCP server",
    desc: "Custom tools, reachability checked before publish",
  },
  smtp: {
    name: "SMTP Email",
    desc: "Reliable transactional delivery with TLS",
  },
}

export function WorksWithSection() {
  return (
    <section id="workswith" style={{ padding: "0 0 112px", position: "relative", zIndex: 1 }}>
      <div className="wrap">
        <div style={{ maxWidth: 680, marginBottom: 40, display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="eyebrow">Works with</div>
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
            The tools you already use — granted per action, never blanket.
          </h2>
          <p style={{ margin: 0, fontSize: 17, lineHeight: 1.55, color: "hsl(220 16% 65%)" }}>
            Read and write are separate grants per application, a workflow only sees the services you
            tick for it, and every outbound write pauses for a person.
          </p>
        </div>

        <div className="appgrid">
          {CONNECTOR_CATALOG.map((service) => {
            const meta = SERVICE_DESCRIPTIONS[service.id] || { desc: "Integrated service capability" }
            const displayName = meta.name || service.name

            return (
              <div key={service.id} className="apptile">
                <div className="apphead">
                  <span className="appwell">{getServiceIcon(service.id, { size: 22 })}</span>
                  <span>{displayName}</span>
                </div>
                <p>{meta.desc}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

import {
  GoogleIcon,
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
} from "./BrandIcons"

export function WorksWithSection() {
  const apps = [
    {
      name: "Google Workspace",
      desc: "Gmail drafts · Calendar · Drive · Docs · Sheets · Contacts",
      icon: <GoogleIcon size={22} />,
    },
    {
      name: "Gmail",
      desc: "Draft replies; nothing sends without you",
      icon: <GmailIcon size={22} />,
    },
    {
      name: "Google Calendar",
      desc: "Find free time, create and update events",
      icon: <CalendarIcon size={22} />,
    },
    {
      name: "Google Drive",
      desc: "Read files into the KB, create and rename",
      icon: <DriveIcon size={22} />,
    },
    {
      name: "Slack",
      desc: "Post summaries and exceptions to a channel",
      icon: <SlackBrandIcon size={22} />,
    },
    {
      name: "GitHub",
      desc: "Issues and repositories as sources and targets",
      icon: <GithubBrandIcon size={22} />,
    },
    {
      name: "Notion",
      desc: "Pages and databases",
      icon: <NotionBrandIcon size={22} />,
    },
    {
      name: "Microsoft 365",
      desc: "Teams, Outlook, SharePoint files",
      icon: <MicrosoftBrandIcon size={22} />,
    },
    {
      name: "Jira",
      desc: "One issue per finding, citation in the body",
      icon: <JiraBrandIcon size={22} />,
    },
    {
      name: "Figma",
      desc: "Design files as context",
      icon: <FigmaBrandIcon size={22} />,
    },
    {
      name: "Linear",
      desc: "Issues and cycles",
      icon: <LinearBrandIcon size={22} />,
    },
    {
      name: "Sentry",
      desc: "Errors and releases",
      icon: <SentryBrandIcon size={22} />,
    },
    {
      name: "Intercom",
      desc: "Conversations and customers",
      icon: <IntercomBrandIcon size={22} />,
    },
    {
      name: "Miro",
      desc: "Boards",
      icon: <MiroBrandIcon size={22} />,
    },
    {
      name: "Any MCP server",
      desc: "Custom tools, reachability checked before publish",
      icon: <McpBrandIcon size={22} />,
    },
  ]

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
          {apps.map((app) => (
            <div key={app.name} className="apptile">
              <div className="apphead">
                <span className="appwell">{app.icon}</span>
                <span>{app.name}</span>
              </div>
              <p>{app.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

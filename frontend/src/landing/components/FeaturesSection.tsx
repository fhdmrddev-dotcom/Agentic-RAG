export function FeaturesSection() {
  return (
    <section id="features" style={{ padding: "0 0 112px", position: "relative", zIndex: 1 }}>
      <div className="wrap">
        <div style={{ maxWidth: 700, marginBottom: 40, display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="eyebrow">Everything inside</div>
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
            One workspace, not six subscriptions.
          </h2>
          <p style={{ margin: 0, fontSize: 17, lineHeight: 1.55, color: "hsl(220 16% 65%)" }}>
            Chat, knowledge base, sandbox, workflow studio, connectors, skills and an operator control
            room — sharing one set of documents and one set of permissions.
          </p>
        </div>

        <div className="grid4">
          <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 10 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="hsl(239 100% 82%)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Hybrid search with citations</h3>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "hsl(220 16% 65%)" }}>
              Semantic plus keyword retrieval with reranking. Numbered markers in the answer link to the exact document and page.
            </p>
          </div>

          <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 10 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="hsl(239 100% 82%)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" x2="20" y1="19" y2="19" />
            </svg>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Sandboxed code execution</h3>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "hsl(220 16% 65%)" }}>
              Python in an isolated container with pandas, matplotlib, openpyxl, python-docx, python-pptx, reportlab and more preinstalled.
            </p>
          </div>

          <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 10 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="hsl(239 100% 82%)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Real output files</h3>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "hsl(220 16% 65%)" }}>
              XLSX, DOCX, PPTX, PDF, PNG charts — previewed in the workspace panel, versioned, downloadable. Fill your own templates.
            </p>
          </div>

          <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 10 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="hsl(239 100% 82%)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
              <path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2" />
              <path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2" />
              <path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8" />
              <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
            </svg>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Human checkpoints</h3>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "hsl(220 16% 65%)" }}>
              Any outbound action — email, Slack, calendar, file write — pauses with a NEEDS YOU card. Approve, edit the draft, or refuse.
            </p>
          </div>

          <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 10 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="hsl(239 100% 82%)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
              <rect width="8" height="8" x="3" y="3" rx="2" />
              <path d="M7 11v4a2 2 0 0 0 2 2h4" />
              <rect width="8" height="8" x="13" y="13" rx="2" />
            </svg>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Workflow Studio</h3>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "hsl(220 16% 65%)" }}>
              Describe recurring work in a sentence or build step-by-step on a canvas. Per-step model, sources, checks and approvals.
            </p>
          </div>

          <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 10 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="hsl(239 100% 82%)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
              <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Publish gauntlet</h3>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "hsl(220 16% 65%)" }}>
              Ten checks including a real golden run against your knowledge base and an independent judge model. Fails are worded, not coded.
            </p>
          </div>

          <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 10 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="hsl(239 100% 82%)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Schedules and run history</h3>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "hsl(220 16% 65%)" }}>
              Run on a cron, on demand from chat, or from the library. Every run keeps its receipt — what ran, what it produced, where it paused.
            </p>
          </div>

          <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 10 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="hsl(239 100% 82%)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
              <path d="M12 2v4" />
              <path d="m16.2 7.8 2.9-2.9" />
              <path d="M18 12h4" />
              <path d="m16.2 16.2 2.9 2.9" />
              <path d="M12 18v4" />
              <path d="m4.9 19.1 2.9-2.9" />
              <path d="M2 12h4" />
              <path d="m4.9 4.9 2.9 2.9" />
            </svg>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Graded governance</h3>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "hsl(220 16% 65%)" }}>
              Per step: must it cite? From which folders only? Strict grounding can be locked — and only the person who locked it can undo it.
            </p>
          </div>

          <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 10 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="hsl(239 100% 82%)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
              <path d="M4 20h16" />
              <path d="m6 16 6-12 6 12" />
              <path d="M8 12h8" />
            </svg>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Teachable skills</h3>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "hsl(220 16% 65%)" }}>
              Teach it a procedure once; it persists as a versioned skill with its own evals, triggers and a studio to tune when it fires.
            </p>
          </div>

          <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 10 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="hsl(239 100% 82%)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
              <path d="M12 22a1 1 0 0 1-1-1v-4a1 1 0 0 1 .445-.832l3-2a1 1 0 0 1 1.11 0l3 2A1 1 0 0 1 19 17v4a1 1 0 0 1-1 1z" />
              <path d="M12 13V2" />
              <path d="m5 8 7-6 7 6" />
            </svg>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Connectors</h3>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "hsl(220 16% 65%)" }}>
              Google Workspace, Slack, GitHub, Notion, Microsoft 365, Jira, email, or any MCP server — granted per workflow, per action.
            </p>
          </div>

          <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 10 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="hsl(239 100% 82%)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
              <path d="M4 4h16v4H4z" />
              <path d="M4 12h16v8H4z" />
            </svg>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Library and knowledge health</h3>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "hsl(220 16% 65%)" }}>
              Folders, saved views, relationships between documents, and a health tab that shows what retrieval could not find.
            </p>
          </div>

          <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 10 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="hsl(239 100% 82%)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M3 9h18" />
              <path d="M9 21V9" />
            </svg>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Operator control room</h3>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "hsl(220 16% 65%)" }}>
              Live runs with a kill switch, dependency health, an audit ledger of every write, users and feature visibility per audience.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

export function HowItWorksSection() {
  return (
    <section id="how-it-works" style={{ padding: "0 0 112px", position: "relative", zIndex: 1 }}>
      <div className="wrap">
        <div style={{ maxWidth: 640, marginBottom: 40, display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="eyebrow">How it works</div>
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
            Upload. Ask. Get the file.
          </h2>
        </div>

        <div className="grid3">
          <div className="card" style={{ padding: 28, display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="mono" style={{ fontSize: 12, color: "hsl(239 100% 82%)" }}>
              01
            </div>
            <h3 className="hl" style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
              Upload your knowledge
            </h3>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "hsl(220 16% 65%)" }}>
              PDF, Word, Excel, PowerPoint, CSV, images, Outlook email. Tables and figures are extracted,
              metadata is read with a confidence you can see, and documents are auto-classified into folders
              and saved views.
            </p>
          </div>

          <div className="card" style={{ padding: 28, display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="mono" style={{ fontSize: 12, color: "hsl(239 100% 82%)" }}>
              02
            </div>
            <h3 className="hl" style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
              Ask in plain language
            </h3>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "hsl(220 16% 65%)" }}>
              The agent decides what to do — search, calculate, draft, build — and shows each step live as it
              happens. Every claim it makes from your documents carries a numbered citation back to the page.
            </p>
          </div>

          <div className="card" style={{ padding: 28, display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="mono" style={{ fontSize: 12, color: "hsl(239 100% 82%)" }}>
              03
            </div>
            <h3 className="hl" style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
              Get a real deliverable
            </h3>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "hsl(220 16% 65%)" }}>
              Spreadsheets, charts, Word and PowerPoint files, PDFs — built by real code in an isolated sandbox
              and dropped into your workspace files. If it needs to send, post or write anywhere outside, it
              asks you first.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

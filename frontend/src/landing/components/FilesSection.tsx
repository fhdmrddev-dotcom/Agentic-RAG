import { INGEST_FORMATS, EXTRACT_CAPABILITIES, PRODUCE_FORMATS } from "../facts"

export function FilesSection() {
  return (
    <section id="files" style={{ padding: "0 0 112px", position: "relative", zIndex: 1 }}>
      <div className="wrap">
        <div style={{ maxWidth: 640, marginBottom: 40, display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="eyebrow">Files</div>
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
            What goes in, what comes out.
          </h2>
        </div>

        <div className="grid3">
          <div className="card" style={{ padding: 26, display: "flex", flexDirection: "column", gap: 14 }}>
            <h3 className="hl" style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Ingest</h3>
            <div className="chips">
              {INGEST_FORMATS.map((fmt) => (
                <span key={fmt} className="chip">{fmt}</span>
              ))}
            </div>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "hsl(220 16% 65%)" }}>
              Scanned PDFs are OCR’d. Email attachments are ingested with the message. Duplicates are detected by content, not filename.
            </p>
          </div>

          <div className="card" style={{ padding: 26, display: "flex", flexDirection: "column", gap: 14 }}>
            <h3 className="hl" style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Extract</h3>
            <div className="chips">
              {EXTRACT_CAPABILITIES.map((layer) => (
                <span key={layer} className="chip">{layer}</span>
              ))}
            </div>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "hsl(220 16% 65%)" }}>
              Tables become queryable rows the agent can aggregate with query_tables; figures are described for retrieval and shown in the detail panel.
            </p>
          </div>

          <div className="card" style={{ padding: 26, display: "flex", flexDirection: "column", gap: 14 }}>
            <h3 className="hl" style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Produce</h3>
            <div className="chips">
              {PRODUCE_FORMATS.map((fmt) => (
                <span key={fmt} className="chip">{fmt}</span>
              ))}
            </div>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "hsl(220 16% 65%)" }}>
              Built by real code — pandas, openpyxl, python-docx, python-pptx, reportlab, matplotlib, plotly, docxtpl — versioned in the workspace and downloadable.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

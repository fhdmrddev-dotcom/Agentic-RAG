import { useState } from "react"
import { CATEGORY_COMPARISON, FULL_COMPARISON_MATRIX, type CompareScore } from "../facts"

export function CompareSection() {
  const [showFullMatrix, setShowFullMatrix] = useState(false)

  const renderMark = (status: CompareScore) => {
    if (status === "full") {
      return <span className="m m-full" title="yes" />
    }
    if (status === "part") {
      return <span className="m m-part" title="partial / varies" />
    }
    return <span className="m m-none" title="no" />
  }

  return (
    <section id="compare" style={{ padding: "0 0 112px", position: "relative", zIndex: 1 }}>
      <div className="wrap">
        <div style={{ maxWidth: 640, marginBottom: 40, display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="eyebrow">Compare</div>
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
            Where it sits next to what you already use.
          </h2>
        </div>

        {/* 8-Row Category Comparison */}
        <div className="card cmp-scroll" style={{ overflow: "hidden" }}>
          <table className="cmp">
            <thead>
              <tr>
                <th style={{ width: "34%" }}>Capability</th>
                <th className="us">Agentic RAG</th>
                <th>General chat assistant</th>
                <th>Enterprise search</th>
                <th>Automation / RPA tool</th>
              </tr>
            </thead>
            <tbody>
              {CATEGORY_COMPARISON.map((row) => (
                <tr key={row.capability}>
                  <td>{row.capability}</td>
                  <td className="us">{renderMark(row.agenticRag)}</td>
                  <td>{renderMark(row.chatAssistant)}</td>
                  <td>{renderMark(row.enterpriseSearch)}</td>
                  <td>{renderMark(row.workflowPlatform)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <p style={{ margin: 0, fontSize: 12, color: "hsl(220 16% 65% / 0.8)" }}>
            Category comparison. Scored on out-of-the-box functionality.
          </p>
          <button
            className="btn btn-outline"
            style={{ height: 36, padding: "0 14px" }}
            onClick={() => setShowFullMatrix(!showFullMatrix)}
          >
            {showFullMatrix ? "Hide full comparison" : "View full 30-point matrix"}
          </button>
        </div>

        {/* 30-Row Full Matrix */}
        {showFullMatrix && (
          <div style={{ marginTop: 32 }}>
            <div style={{ maxWidth: 700, marginBottom: 20, display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="eyebrow">The full picture</div>
              <h3 className="hl" style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>
                Thirty things, five ways of getting them.
              </h3>
              <div className="legend">
                <span><span className="m m-full" /> yes, out of the box</span>
                <span><span className="m m-part" /> partial, or varies by product and plan</span>
                <span><span className="m m-none" /> no</span>
              </div>
            </div>

            <div className="card cmp-scroll" style={{ overflow: "hidden" }}>
              <table className="cmp2">
                <thead>
                  <tr>
                    <th style={{ width: "34%" }}>Capability</th>
                    <th className="us">Agentic RAG</th>
                    <th>General AI chat</th>
                    <th>Enterprise search</th>
                    <th>Workflow platform</th>
                    <th>In-house build</th>
                  </tr>
                </thead>
                <tbody>
                  {FULL_COMPARISON_MATRIX.map((row, index) => (
                    <tr key={`${row.capability}-${index}`}>
                      <td>{row.capability}</td>
                      <td className="us">{renderMark(row.agenticRag)}</td>
                      <td>{renderMark(row.chatAssistant)}</td>
                      <td>{renderMark(row.enterpriseSearch)}</td>
                      <td>{renderMark(row.workflowPlatform)}</td>
                      <td>{renderMark(row.inHouseBuild)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

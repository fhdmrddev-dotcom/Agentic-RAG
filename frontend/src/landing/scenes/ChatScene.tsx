import "./scenes.css"

export function ChatScene() {
  return (
    <div className="scene sc-chat" aria-label="Interactive chat storyboard demonstrating tools, file creation, and human-in-the-loop approval">
      <div className="sfloor" aria-hidden="true" />

      {/* User prompt pill */}
      <div
        className="el mini c-prompt"
        style={{
          left: 28,
          top: 24,
          padding: "10px 14px",
          borderRadius: "14px 14px 4px 14px",
          background: "linear-gradient(135deg, hsl(239 84% 67%), hsl(258 90% 66%))",
          border: 0,
          color: "#fff",
          maxWidth: 300,
          lineHeight: 1.4,
        }}
      >
        Total Q3 spend per vendor from the invoices folder, then email Finance.
      </div>

      {/* Lifted document cards with citation scores */}
      <div
        className="el c-docs"
        style={{
          left: 60,
          top: 150,
          display: "flex",
          gap: 18,
          transform: "rotateY(-18deg) rotateX(6deg)",
          transformStyle: "preserve-3d",
        }}
      >
        <div className="docc c-d1">
          <span className="dlabel">INV_0931</span>
          <i className="dscore" style={{ "--w": "91%" } as Record<string, string>} />
        </div>
        <div className="docc c-d2">
          <span className="dlabel">memo.docx</span>
          <i className="dscore dscore-low" style={{ "--w": "14%" } as Record<string, string>} />
        </div>
        <div className="docc c-d3">
          <span className="dlabel">INV_0944</span>
          <i className="dscore" style={{ "--w": "84%" } as Record<string, string>} />
        </div>
      </div>

      {/* Laser scanner beam */}
      <div
        className="el c-beam"
        aria-hidden="true"
        style={{
          left: 40,
          top: 130,
          width: 3,
          height: 130,
          background: "linear-gradient(180deg, transparent, hsl(239 100% 82%), transparent)",
          boxShadow: "0 0 18px 4px hsl(239 100% 82% / .5)",
        }}
      />

      {/* Live Run Card */}
      <div
        className="el mini c-run"
        style={{
          right: 28,
          top: 28,
          width: 340,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "10px 12px",
            borderBottom: "1px solid hsl(220 20% 16% / .6)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontWeight: 600 }}>Run · 3 steps</span>
          <span className="font-mono text-[11px] text-muted-foreground">claude-sonnet-5</span>
        </div>
        <div className="crow c-s1">
          <span className="ck">✓</span>
          Searched knowledge base <span className="dim">· 2 matched</span>
        </div>
        <div className="crow c-s2">
          <span className="ck">✓</span>
          Ran code in sandbox <span className="dim">· q3_vendor_spend.xlsx</span>
        </div>
        <div className="crow c-s3">
          <span className="amber-dot" />
          Email the summary to Finance <span className="needs font-mono">NEEDS YOU</span>
        </div>
      </div>

      {/* Executed Code Pill */}
      <div
        className="el mini font-mono c-code"
        style={{
          right: 44,
          top: 190,
          padding: "8px 10px",
          fontSize: 11,
          lineHeight: 1.5,
          color: "hsl(226 60% 97%)",
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        df.groupby("vendor")["total"].sum()
        <br />
        wb.save("q3_vendor_spend.xlsx") # exit 0
      </div>

      {/* Produced File Output Pill */}
      <div
        className="el mini c-file"
        style={{
          left: 60,
          top: 268,
          padding: "10px 12px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span
          className="tag"
          style={{
            background: "hsl(142 71% 45% / .15)",
            color: "hsl(142 71% 55%)",
          }}
        >
          xlsx
        </span>
        <span className="font-mono text-xs">q3_vendor_spend.xlsx</span>
      </div>

      {/* Approval Card (NEEDS YOU) */}
      <div
        className="el mini c-ask"
        style={{
          right: 28,
          bottom: 22,
          width: 300,
          padding: 12,
          borderColor: "hsl(38 92% 60% / .5)",
          background: "hsl(38 92% 60% / .08)",
        }}
      >
        <div className="needs font-mono" style={{ marginBottom: 6 }}>
          NEEDS YOU
        </div>
        <div style={{ lineHeight: 1.45, marginBottom: 8 }}>
          Send the Q3 summary to finance@? Nothing goes out until you say so.
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <span
            className="pillbtn"
            style={{
              background: "hsl(38 92% 60%)",
              color: "hsl(240 60% 8%)",
            }}
          >
            Send it
          </span>
          <span
            className="pillbtn"
            style={{
              background: "hsl(220 25% 14%)",
            }}
          >
            Show me the draft
          </span>
        </div>
      </div>

      <div className="el scap">
        Ask → search your documents → run real code → get the file → approve before it sends
      </div>
    </div>
  )
}

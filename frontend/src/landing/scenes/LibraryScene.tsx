import "./scenes.css"

export function LibraryScene() {
  return (
    <div className="scene sc-lib" aria-label="Interactive library storyboard demonstrating PDF decomposition into text, tables, and figures">
      <div className="sfloor" aria-hidden="true" />

      {/* Incoming PDF Document */}
      <div
        className="el l-pdf docc"
        style={{
          left: 90,
          top: 120,
          width: 96,
          height: 128,
        }}
      >
        <span
          className="tag"
          style={{
            position: "absolute",
            left: 8,
            bottom: 8,
            background: "hsl(0 72% 51% / .18)",
            color: "hsl(0 80% 80%)",
          }}
        >
          pdf
        </span>
      </div>

      {/* Layer 1: Text */}
      <div
        className="el mini l-layer l-text"
        style={{
          left: 90,
          top: 120,
          width: 150,
          padding: 10,
        }}
      >
        <div className="font-mono l-h">TEXT</div>
        <div className="lines">
          <i />
          <i style={{ width: "80%" }} />
          <i style={{ width: "90%" }} />
          <i style={{ width: "55%" }} />
        </div>
      </div>

      {/* Layer 2: Table */}
      <div
        className="el mini l-layer l-table"
        style={{
          left: 90,
          top: 120,
          width: 150,
          padding: 10,
        }}
      >
        <div className="font-mono l-h">TABLE → ROWS</div>
        <div className="grid-preview">
          <b /><b /><b /><b /><b /><b /><b /><b /><b />
        </div>
      </div>

      {/* Layer 3: Figure */}
      <div
        className="el mini l-layer l-img"
        style={{
          left: 90,
          top: 120,
          width: 150,
          padding: 10,
        }}
      >
        <div className="font-mono l-h">FIGURE</div>
        <div
          style={{
            height: 44,
            borderRadius: 6,
            background: "linear-gradient(135deg, hsl(239 84% 67% / .5), hsl(258 90% 66% / .3))",
          }}
        />
      </div>

      {/* Extraction Metadata Chips */}
      <div
        className="el l-chips"
        style={{
          left: 300,
          top: 70,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <span
          className="tag l-c1"
          style={{
            background: "hsl(142 71% 55% / .15)",
            color: "hsl(142 71% 55%)",
          }}
        >
          title · extracted · 0.93
        </span>
        <span
          className="tag l-c2"
          style={{
            background: "hsl(38 92% 62% / .15)",
            color: "hsl(38 92% 62%)",
          }}
        >
          date · medium · 0.61
        </span>
        <span
          className="tag l-c3"
          style={{
            border: "1px solid hsl(220 20% 16%)",
            color: "hsl(220 16% 65%)",
          }}
        >
          3 tables · 2 figures · 14 pages
        </span>
      </div>

      {/* Target Knowledge Folder */}
      <div
        className="el l-folder"
        style={{
          right: 60,
          top: 150,
          width: 120,
          height: 90,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 48,
            height: 14,
            borderRadius: "6px 6px 0 0",
            background: "hsl(239 100% 82% / .35)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 10,
            right: 0,
            bottom: 0,
            borderRadius: "0 8px 8px 8px",
            background: "linear-gradient(180deg, hsl(239 84% 67% / .45), hsl(239 84% 67% / .2))",
            border: "1px solid hsl(239 100% 82% / .4)",
          }}
        />
        <div
          className="font-mono"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: -28,
            textAlign: "center",
            fontSize: 11,
            color: "hsl(220 16% 65%)",
          }}
        >
          Finance / Q3 · <span className="l-count">15</span> docs
        </div>
      </div>

      <div className="el scap">
        Upload → text, tables and figures extracted → metadata with a confidence you can see → filed, with a suggestion you accept
      </div>
    </div>
  )
}

import { MODEL_PROVIDERS } from "../facts"
import "./scenes.css"

export function ControlRoomScene() {
  const keyedCount = MODEL_PROVIDERS.length - 1
  const totalCount = MODEL_PROVIDERS.length

  return (
    <div className="scene sc-cr" aria-label="Interactive control room storyboard demonstrating platform vitals, active run termination, and audit ledger receipts">
      <div className="sfloor" aria-hidden="true" />

      {/* Top vitals row */}
      <div
        className="el r-vitals"
        style={{
          left: 24,
          right: 24,
          top: 24,
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 10,
        }}
      >
        <div className="mini rv">
          <span className="rdot r-d1" />
          Database<em>12 ms</em>
        </div>
        <div className="mini rv">
          <span className="rdot r-d2" />
          Redis<em>1 ms</em>
        </div>
        <div className="mini rv">
          <span className="rdot r-d3" />
          Sandbox<em className="r-sb">3 warm</em>
        </div>
        <div className="mini rv">
          <span className="rdot r-d4" />
          Providers<em>{keyedCount} / {totalCount} keyed</em>
        </div>
      </div>

      {/* Active Run Card */}
      <div
        className="el mini r-run"
        style={{
          left: 24,
          top: 104,
          width: 360,
          padding: "10px 12px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span className="rdot r-rd" />
        <div style={{ flex: "1 1 0", minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="font-mono text-xs">weekly-report · run 4f2a</span>
            <span className="font-mono r-elapsed text-[11px] text-muted-foreground">04:12</span>
          </div>
          <div
            style={{
              height: 4,
              borderRadius: 2,
              background: "hsl(220 25% 14%)",
              marginTop: 6,
              overflow: "hidden",
            }}
          >
            <div
              className="r-bar"
              style={{
                height: "100%",
                background: "hsl(239 100% 82%)",
              }}
            />
          </div>
        </div>
        <span
          className="pillbtn r-kill"
          style={{
            background: "hsl(0 72% 51%)",
            color: "#fff",
          }}
        >
          Kill
        </span>
      </div>

      {/* Stopped Run Card */}
      <div
        className="el mini r-stopped"
        style={{
          left: 24,
          top: 104,
          width: 360,
          padding: "10px 12px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          borderColor: "hsl(0 72% 51% / .5)",
        }}
      >
        <span
          className="rdot"
          style={{
            background: "hsl(0 72% 51%)",
            animation: "none",
          }}
        />
        <span className="font-mono text-xs">weekly-report · run 4f2a</span>
        <span className="dim" style={{ marginLeft: "auto" }}>
          stopped by operator
        </span>
      </div>

      {/* Kill Switches Card */}
      <div
        className="el mini r-switch"
        style={{
          right: 24,
          top: 104,
          width: 190,
          padding: "10px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div
          className="font-mono"
          style={{
            fontSize: 10,
            letterSpacing: ".08em",
            color: "hsl(220 16% 65%)",
          }}
        >
          KILL SWITCHES
        </div>
        <div className="rsw">
          <span>live_connectors</span>
          <span className="t-tog r-t1">
            <i />
          </span>
        </div>
        <div className="rsw">
          <span>sandbox</span>
          <span className="t-tog on">
            <i />
          </span>
        </div>
        <div className="rsw">
          <span>web_search</span>
          <span className="t-tog on">
            <i />
          </span>
        </div>
      </div>

      {/* Audit Ledger */}
      <div
        className="el mini r-led font-mono"
        style={{
          left: 24,
          right: 24,
          bottom: 60,
          padding: "10px 12px",
          fontSize: 11,
          lineHeight: 1.8,
          color: "hsl(220 16% 65%)",
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: ".08em",
            marginBottom: 2,
          }}
        >
          AUDIT LEDGER
        </div>
        <div className="rl r-l1">
          <span style={{ color: "hsl(239 100% 82%)" }}>✎</span> kill_run · run 4f2a · operator@ · 12:04:31
        </div>
        <div className="rl r-l2">
          <span style={{ color: "hsl(239 100% 82%)" }}>✎</span> feature_off · live_connectors · scope: org · 12:04:58
        </div>
        <div className="rl r-l3">
          <span style={{ color: "hsl(142 71% 55%)" }}>receipt</span> audit.csv exported · 214 rows
        </div>
      </div>

      <div className="el scap">
        Watch the vitals → kill a runaway run → flip a guarded switch → every action lands in the ledger
      </div>
    </div>
  )
}

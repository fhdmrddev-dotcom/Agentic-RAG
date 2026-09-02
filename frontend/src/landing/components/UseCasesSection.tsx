import { SlackBrandIcon, GmailIcon, CalendarIcon, LmStudioIcon, McpBrandIcon } from "./BrandIcons"

export function UseCasesSection() {
  return (
    <section id="teams" style={{ padding: "0 0 112px", position: "relative", zIndex: 1 }}>
      <div className="wrap">
        <div style={{ maxWidth: 640, marginBottom: 40, display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="eyebrow">Business cases</div>
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
            Who uses it, and for what.
          </h2>
        </div>

        <div className="grid3">
          {/* Finance */}
          <div className="card" style={{ padding: 26, display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="ucviz tight">
              <div className="ucstack">
                <div className="ucn">
                  <span className="mono ext" style={{ background: "hsl(0 80% 80% / 0.15)", color: "hsl(0 80% 80%)" }}>PDF</span>
                </div>
                <div className="ucn">
                  <span className="mono ext" style={{ background: "hsl(0 80% 80% / 0.15)", color: "hsl(0 80% 80%)" }}>INV</span>
                </div>
              </div>
              <div className="ucarr"><i /><b /></div>
              <div className="ucn agent">
                <span className="lbl" style={{ color: "#ffffff", fontWeight: 700 }}>agent</span>
              </div>
              <div className="ucarr"><i /><b /></div>
              <div className="ucstack">
                <div className="ucn">
                  <span className="mono ext" style={{ background: "hsl(142 71% 45% / 0.15)", color: "hsl(142 71% 55%)" }}>XLSX</span>
                </div>
                <div className="ucn">
                  <span className="mono ext" style={{ background: "hsl(142 71% 45% / 0.15)", color: "hsl(142 71% 55%)" }}>DIFF</span>
                </div>
              </div>
              <div className="ucarr"><i /><b /></div>
              <div className="ucn">
                <SlackBrandIcon size={18} />
                <span className="lbl">post</span>
              </div>
            </div>
            <h3 className="hl" style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Finance</h3>
            <ul className="uc">
              <li>Month-end: invoices → vendor spend workbook, exceptions to Slack</li>
              <li>Contract renewal calendar from the legal folder</li>
              <li>Board pack from last quarter’s reports in the house template</li>
            </ul>
          </div>

          {/* Construction & engineering */}
          <div className="card" style={{ padding: 26, display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="ucviz tight">
              <div className="ucstack">
                <div className="ucn">
                  <span className="mono ext" style={{ background: "hsl(24 90% 60% / 0.15)", color: "hsl(24 90% 60%)" }}>DXF</span>
                </div>
                <div className="ucn">
                  <span className="mono ext" style={{ background: "hsl(24 90% 60% / 0.15)", color: "hsl(24 90% 60%)" }}>SPEC</span>
                </div>
              </div>
              <div className="ucarr"><i /><b /></div>
              <div className="ucn agent">
                <span className="lbl" style={{ color: "#ffffff", fontWeight: 700 }}>agent</span>
              </div>
              <div className="ucarr"><i /><b /></div>
              <div className="ucstack">
                <div className="ucn">
                  <span className="mono ext" style={{ background: "hsl(142 71% 45% / 0.15)", color: "hsl(142 71% 55%)" }}>XLSX</span>
                </div>
                <div className="ucn">
                  <span className="mono ext" style={{ background: "hsl(239 100% 82% / 0.15)", color: "hsl(239 100% 82%)" }}>CITE</span>
                </div>
              </div>
            </div>
            <h3 className="hl" style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Construction &amp; engineering</h3>
            <ul className="uc">
              <li>Takeoff from drawings (DXF) and specs into a quantities sheet, page-cited</li>
              <li>RFI and submittal log kept from email threads</li>
              <li>Roofing / membrane quotes from a rate sheet skill</li>
            </ul>
          </div>

          {/* Operations */}
          <div className="card" style={{ padding: 26, display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="ucviz tight">
              <div className="ucstack">
                <div className="ucn">
                  <span className="mono ext" style={{ background: "hsl(239 100% 82% / 0.15)", color: "hsl(239 100% 82%)" }}>SOP</span>
                </div>
                <div className="ucn">
                  <span className="mono ext" style={{ background: "hsl(239 100% 82% / 0.15)", color: "hsl(239 100% 82%)" }}>LOG</span>
                </div>
              </div>
              <div className="ucarr"><i /><b /></div>
              <div className="ucn agent">
                <span className="lbl" style={{ color: "#ffffff", fontWeight: 700 }}>agent</span>
              </div>
              <div className="ucarr"><i /><b /></div>
              <div className="ucn">
                <span className="mono ext" style={{ background: "hsl(239 100% 82% / 0.15)", color: "hsl(239 100% 82%)" }}>DOCX</span>
                <span className="lbl">report</span>
              </div>
              <div className="ucarr"><i /><b /></div>
              <div className="ucn pause">
                <GmailIcon size={18} />
                <span className="lbl">draft</span>
              </div>
            </div>
            <h3 className="hl" style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Operations</h3>
            <ul className="uc">
              <li>SOP assistant that answers with the clause and the page</li>
              <li>Weekly team progress report, drafted and paused for review</li>
              <li>Meeting notes → actions → Jira issues, one per finding</li>
            </ul>
          </div>

          {/* Legal & compliance */}
          <div className="card" style={{ padding: 26, display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="ucviz tight">
              <div className="ucstack">
                <div className="ucn">
                  <span className="mono ext" style={{ background: "hsl(0 80% 80% / 0.15)", color: "hsl(0 80% 80%)" }}>DOC</span>
                </div>
                <div className="ucn">
                  <span className="mono ext" style={{ background: "hsl(226 60% 97% / 0.15)", color: "hsl(226 60% 97%)" }}>LAW</span>
                </div>
              </div>
              <div className="ucarr"><i /><b /></div>
              <div className="ucn agent" title="strict grounding">
                <span className="lbl" style={{ color: "#ffffff", fontWeight: 700 }}>strict</span>
              </div>
              <div className="ucarr"><i /><b /></div>
              <div className="ucstack">
                <div className="ucn">
                  <CalendarIcon size={18} />
                </div>
                <div className="ucn">
                  <span className="mono ext" style={{ background: "hsl(38 92% 62% / 0.15)", color: "hsl(38 92% 62%)" }}>AUDIT</span>
                </div>
              </div>
            </div>
            <h3 className="hl" style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Legal &amp; compliance</h3>
            <ul className="uc">
              <li>Clause search across every contract with citations</li>
              <li>Monthly policy-drift sweep against the current handbook</li>
              <li>Strict-grounded workflows that may only cite the approved folder</li>
            </ul>
          </div>

          {/* Sales & customer teams */}
          <div className="card" style={{ padding: 26, display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="ucviz tight">
              <div className="ucstack">
                <div className="ucn">
                  <span className="mono ext" style={{ background: "hsl(239 100% 82% / 0.15)", color: "hsl(239 100% 82%)" }}>DECK</span>
                </div>
                <div className="ucn">
                  <span className="mono ext" style={{ background: "hsl(239 100% 82% / 0.15)", color: "hsl(239 100% 82%)" }}>CRM</span>
                </div>
              </div>
              <div className="ucarr"><i /><b /></div>
              <div className="ucn agent">
                <span className="lbl" style={{ color: "#ffffff", fontWeight: 700 }}>agent</span>
              </div>
              <div className="ucarr"><i /><b /></div>
              <div className="ucstack">
                <div className="ucn">
                  <span className="mono ext" style={{ background: "hsl(24 90% 60% / 0.15)", color: "hsl(24 90% 60%)" }}>PPTX</span>
                </div>
                <div className="ucn">
                  <CalendarIcon size={18} />
                </div>
              </div>
            </div>
            <h3 className="hl" style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Sales &amp; customer teams</h3>
            <ul className="uc">
              <li>Proposal drafts from the case-study library into the deck template</li>
              <li>Account brief before a call: contracts, tickets, last emails</li>
              <li>Free-time search and calendar invite, drafted for approval</li>
            </ul>
          </div>

          {/* IT & data */}
          <div className="card" style={{ padding: 26, display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="ucviz tight">
              <div className="ucstack">
                <div className="ucn">
                  <LmStudioIcon size={18} />
                </div>
                <div className="ucn">
                  <McpBrandIcon size={18} />
                </div>
              </div>
              <div className="ucarr"><i /><b /></div>
              <div className="ucn agent">
                <span className="lbl" style={{ color: "#ffffff", fontWeight: 700 }}>agent</span>
              </div>
              <div className="ucarr"><i /><b /></div>
              <div className="ucstack">
                <div className="ucn">
                  <span className="mono ext" style={{ background: "hsl(142 71% 55% / 0.15)", color: "hsl(142 71% 55%)" }}>RLS</span>
                </div>
                <div className="ucn">
                  <span className="mono ext" style={{ background: "hsl(0 72% 55% / 0.15)", color: "hsl(0 72% 55%)" }}>KILL</span>
                </div>
              </div>
            </div>
            <h3 className="hl" style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>IT &amp; data</h3>
            <ul className="uc">
              <li>Run local models for restricted data; cloud for the rest</li>
              <li>Kill switches, audit ledger and model registry for governance</li>
              <li>Custom MCP servers exposed to workflows with reachability checked</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

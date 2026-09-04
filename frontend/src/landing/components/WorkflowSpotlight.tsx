import { GAUNTLET_STAGES } from "../facts"

export function WorkflowSpotlight() {
  return (
    <section id="workflows" style={{ padding: "0 0 112px", position: "relative", zIndex: 1 }}>
      <div className="wrap">
        <div
          className="card"
          style={{
            padding: 48,
            display: "flex",
            flexDirection: "column",
            gap: 36,
            background: "linear-gradient(135deg, hsl(220 30% 7%), hsl(239 84% 67% / 0.07))",
          }}
        >
          <div className="grid2" style={{ alignItems: "start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="eyebrow">Workflow Studio</div>
              <h2
                className="hl h2"
                style={{
                  margin: 0,
                  fontSize: 36,
                  lineHeight: 1.1,
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                }}
              >
                Automation that has to prove itself before it runs for you.
              </h2>
              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: "hsl(220 16% 65%)" }}>
                Two doors, same destination: describe the work and let the AI draft the steps, or open the
                editor and set each step yourself — what it must cite, which checks have to pass, and which
                model runs each step. Either way it cannot publish until every check below goes green.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 14, color: "hsl(220 16% 65%)" }}>
              <div style={{ display: "flex", gap: 10 }}>
                <span className="dot" style={{ background: "hsl(239 100% 82%)", marginTop: 7, flexShrink: 0 }} />
                <span>
                  <strong style={{ color: "hsl(226 60% 97%)" }}>Per-step model.</strong> Cheap model for extraction, strongest for judgment, local for anything that must not leave the network.
                </span>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <span className="dot" style={{ background: "hsl(239 100% 82%)", marginTop: 7, flexShrink: 0 }} />
                <span>
                  <strong style={{ color: "hsl(226 60% 97%)" }}>Per-step grounding.</strong> Which folders it may read, whether it must cite, whether a human must review before the next step.
                </span>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <span className="dot" style={{ background: "hsl(239 100% 82%)", marginTop: 7, flexShrink: 0 }} />
                <span>
                  <strong style={{ color: "hsl(226 60% 97%)" }}>Declared inputs.</strong> Ask for a date range or a customer name at launch — from chat, from the library, or on a schedule.
                </span>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <span className="dot" style={{ background: "hsl(239 100% 82%)", marginTop: 7, flexShrink: 0 }} />
                <span>
                  <strong style={{ color: "hsl(226 60% 97%)" }}>Templates.</strong> Hand it your own Word or PowerPoint template and it fills it, rather than inventing a layout.
                </span>
              </div>
            </div>
          </div>

          {/* Gauntlet Strip */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div
              className="mono"
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.08em",
                color: "hsl(220 16% 65%)",
              }}
            >
              THE PUBLISH GAUNTLET · {GAUNTLET_STAGES.length} CHECKS
            </div>

            <div className="pipstrip" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {GAUNTLET_STAGES.map((stage, idx) => {
                const isPassed = idx < 6
                const isRunning = idx === 6

                return (
                  <div key={stage.label} style={{ display: "flex", alignItems: "center", flex: idx < GAUNTLET_STAGES.length - 1 ? "1 1 0" : undefined }}>
                    <div
                      className={`pip ${isPassed ? "done" : isRunning ? "run" : ""}`}
                      title={`${idx + 1}. ${stage.label}`}
                    >
                      {isPassed && (
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="hsl(142 71% 55%)"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ width: 14, height: 14 }}
                        >
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      )}
                      {isRunning && <span className="dot" style={{ background: "hsl(38 92% 60%)" }} />}
                    </div>
                    {idx < GAUNTLET_STAGES.length - 1 && (
                      <div
                        className={`wire ${isPassed && idx < 5 ? "lit" : isPassed && idx === 5 ? "lit comet" : ""}`}
                      />
                    )}
                  </div>
                )
              })}
            </div>

            <div className="grid2" style={{ gap: "8px 32px", fontSize: 13, color: "hsl(220 16% 65%)" }}>
              <div>
                <span className="mono" style={{ color: "hsl(142 71% 55%)" }}>{"1–6"}</span> · Owner · Valid · Goal · Structure · Pause · Grounding — the folders, tools and skills this workflow points at must all resolve
              </div>
              <div>
                <span className="mono" style={{ color: "hsl(38 92% 62%)" }}>{"7"}</span> · Golden run — a real run against your knowledge base, right now
              </div>
              <div>
                <span className="mono">{"8"}</span> · Citations — integrity checked during that run
              </div>
              <div>
                <span className="mono">{"9–10"}</span> · Judge — an independent model grades the deliverable · Commit — the draft must not have changed while we were checking it
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

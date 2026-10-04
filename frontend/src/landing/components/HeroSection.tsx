import { useCallback, useEffect, useRef, useState, type ComponentType } from "react"
import { MODEL_PROVIDERS, LOCAL_RUNTIMES, GAUNTLET_STAGES, HERO_FACTS } from "../facts"

export function HeroSection() {
  const stageRef = useRef<HTMLDivElement>(null)
  const tiltRef = useRef<HTMLDivElement>(null)

  const demoUrl = (import.meta.env.VITE_DEMO_URL as string | undefined) || "#start"

  useEffect(() => {
    const stage = stageRef.current
    const tilt = tiltRef.current
    if (!stage || !tilt) return

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (mediaQuery.matches) return

    const handleMouseMove = (e: MouseEvent) => {
      const rect = stage.getBoundingClientRect()
      const x = (e.clientX - rect.left) / rect.width - 0.5
      const y = (e.clientY - rect.top) / rect.height - 0.5
      tilt.style.transform = `rotateX(${(-y * 12).toFixed(2)}deg) rotateY(${(x * 16).toFixed(2)}deg)`
    }

    const handleMouseLeave = () => {
      tilt.style.transform = ""
    }

    stage.addEventListener("mousemove", handleMouseMove)
    stage.addEventListener("mouseleave", handleMouseLeave)

    return () => {
      stage.removeEventListener("mousemove", handleMouseMove)
      stage.removeEventListener("mouseleave", handleMouseLeave)
    }
  }, [])

  const totalProviders = MODEL_PROVIDERS.length + LOCAL_RUNTIMES.length

  return (
    <section style={{ padding: "88px 0 56px", position: "relative", zIndex: 1 }}>
      {/* ── Headline & Intro ── */}
      <div className="wrap">
        <div style={{ maxWidth: 800, display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              alignSelf: "flex-start",
              height: 28,
              padding: "0 12px",
              borderRadius: 9999,
              border: "1px solid hsl(220 20% 16%)",
              background: "hsl(220 30% 7%)",
              fontSize: 12,
              fontWeight: 500,
              color: "hsl(220 16% 65%)",
            }}
          >
            <span className="dot" style={{ background: "hsl(142 71% 45%)" }} />
            Chat · Knowledge base · Sandbox · Workflows · Connectors — one workspace
          </div>

          <h1
            className="hl h1"
            style={{
              margin: 0,
              fontSize: 64,
              lineHeight: 1.02,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: "hsl(226 60% 97%)",
            }}
          >
            An AI agent that knows your documents, does the work, and asks before it acts.
          </h1>

          <p
            style={{
              margin: 0,
              fontSize: 19,
              lineHeight: 1.55,
              color: "hsl(220 16% 65%)",
              maxWidth: 660,
            }}
          >
            Upload your files. Ask in plain language. It searches your knowledge base with citations,
            runs real code in an isolated sandbox, hands you the finished spreadsheet or report — and
            pauses for your approval before anything leaves the building.
          </p>

          <div className="cta-row" style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 8 }}>
            <a className="btn btn-primary btn-lg" href={demoUrl}>
              Book a demo
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </a>
            <a className="btn btn-outline btn-lg" href="#features">
              Explore everything it does
            </a>
          </div>
        </div>
      </div>

      {/* ── 3D Product Stage ── */}
      <div className="wrap" style={{ marginTop: 48 }}>
        <div ref={stageRef} className="stage hero-stage" style={{ position: "relative", padding: "24px 0 60px" }}>
          <div className="hfloor" aria-hidden="true" />
          <div className="hfade" aria-hidden="true" />

          <div ref={tiltRef} className="tilt" style={{ position: "relative" }}>
            <div
              style={{
                borderRadius: 14,
                border: "1px solid hsl(220 20% 16%)",
                background: "hsl(220 30% 7%)",
                boxShadow: "0 50px 120px -40px hsl(239 84% 67% / 0.35), 0 0 0 1px hsl(216 45% 4%)",
                overflow: "hidden",
              }}
            >
              <div style={{ display: "flex", height: 540 }}>
                {/* Left Navigation Rail */}
                <div
                  className="mock-rail"
                  style={{
                    width: 56,
                    flexShrink: 0,
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                    padding: "12px 0",
                    background: "hsl(220 40% 5%)",
                    borderRight: "1px solid hsl(220 20% 16% / 0.4)",
                  }}
                >
                  <img src="/brand/syrel-mark-iris.svg" width={32} height={32} alt="" aria-hidden="true" />
                  <div style={{ height: 8 }} />
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: "hsl(220 25% 14%)" }} />
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: "hsl(239 100% 82% / 0.14)",
                      border: "1px solid hsl(239 100% 82% / 0.35)",
                    }}
                  />
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      border: "1px solid hsl(220 20% 16% / 0.6)",
                    }}
                  />
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      border: "1px solid hsl(220 20% 16% / 0.6)",
                    }}
                  />
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      border: "1px solid hsl(220 20% 16% / 0.6)",
                    }}
                  />
                </div>

                {/* Central Chat Panel */}
                <div style={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column" }}>
                  <div
                    style={{
                      height: 48,
                      display: "flex",
                      alignItems: "center",
                      padding: "0 24px",
                      borderBottom: "1px solid hsl(220 20% 16% / 0.5)",
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    Q3 vendor spend summary
                  </div>

                  <div
                    style={{
                      flex: "1 1 0",
                      padding: "20px 24px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 16,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        alignSelf: "flex-end",
                        maxWidth: 440,
                        padding: "10px 14px",
                        borderRadius: "14px 14px 4px 14px",
                        background: "linear-gradient(135deg, hsl(239 84% 67%), hsl(258 90% 66%))",
                        color: "#ffffff",
                        fontSize: 14,
                        lineHeight: 1.45,
                      }}
                    >
                      Total our Q3 spend per vendor from the invoices folder, put it in a spreadsheet, and
                      email Finance the summary.
                    </div>

                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <img
                        src="/brand/syrel-mark-iris.svg"
                        width={32}
                        height={32}
                        alt=""
                        aria-hidden="true"
                        style={{ flexShrink: 0 }}
                      />

                      <div
                        style={{
                          flex: "1 1 0",
                          minWidth: 0,
                          borderRadius: 10,
                          border: "1px solid hsl(220 20% 16%)",
                          background: "hsl(216 45% 4%)",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            padding: "14px 16px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            borderBottom: "1px solid hsl(220 20% 16% / 0.6)",
                          }}
                        >
                          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                            <span style={{ fontSize: 14, fontWeight: 600 }}>Run · 3 steps</span>
                            <span className="mono text-xs text-muted-foreground">claude-sonnet-5</span>
                          </div>
                          <span
                            className="mono"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              fontSize: 12,
                              padding: "3px 8px",
                              borderRadius: 9999,
                              border: "1px solid hsl(220 20% 16%)",
                              color: "hsl(142 71% 55%)",
                            }}
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              style={{ width: 12, height: 12 }}
                            >
                              <circle cx="12" cy="12" r="10" />
                              <polyline points="12 6 12 12 16 14" />
                            </svg>
                            18.4s
                          </span>
                        </div>
                        <div
                          className="step s1"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "10px 16px",
                            fontSize: 13,
                            borderBottom: "1px solid hsl(220 20% 16% / 0.4)",
                          }}
                        >
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
                          <span>Searched knowledge base</span>
                          <span style={{ color: "hsl(220 16% 65%)" }}>
                            · 14 invoices in <span className="mono">Finance / Q3</span>
                          </span>
                        </div>
                        <div
                          className="step s2"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "10px 16px",
                            fontSize: 13,
                            borderBottom: "1px solid hsl(220 20% 16% / 0.4)",
                          }}
                        >
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
                          <span>Ran code in sandbox</span>
                          <span style={{ color: "hsl(220 16% 65%)" }}>
                            · wrote <span className="mono">q3_vendor_spend.xlsx</span>
                          </span>
                        </div>
                        <div
                          className="step s3"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "10px 16px",
                            fontSize: 13,
                          }}
                        >
                          <span
                            style={{
                              width: 14,
                              height: 14,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <span className="dot" style={{ background: "hsl(38 92% 60%)" }} />
                          </span>
                          <span>Email the summary to Finance</span>
                          <span
                            className="mono"
                            style={{
                              marginLeft: "auto",
                              fontSize: 11,
                              fontWeight: 600,
                              letterSpacing: "0.06em",
                              color: "hsl(38 92% 62%)",
                            }}
                          >
                            NEEDS YOU
                          </span>
                        </div>
                        <div className="shim" />
                      </div>
                    </div>

                    <div style={{ paddingLeft: 44, fontSize: 14, lineHeight: 1.6 }}>
                      Across 14 invoices, Q3 spend was <strong>$184,320</strong> over 9 vendors{" "}
                      <span
                        className="mono"
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: "1px 4px",
                          borderRadius: 4,
                          background: "hsl(239 100% 82% / 0.15)",
                          color: "hsl(239 100% 82%)",
                          verticalAlign: "super",
                        }}
                      >
                        1
                      </span>
                      . Northwind is 41% of it{" "}
                      <span
                        className="mono"
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: "1px 4px",
                          borderRadius: 4,
                          background: "hsl(239 100% 82% / 0.15)",
                          color: "hsl(239 100% 82%)",
                          verticalAlign: "super",
                        }}
                      >
                        2
                      </span>
                      . The spreadsheet is in your files — I paused before emailing anyone.
                    </div>
                  </div>

                  <div style={{ padding: "0 24px 10px" }}>
                    <div
                      style={{
                        height: 56,
                        borderRadius: 12,
                        border: "1px solid hsl(220 20% 16%)",
                        background: "hsl(216 45% 4%)",
                        display: "flex",
                        alignItems: "center",
                        padding: "0 16px",
                        fontSize: 14,
                        color: "hsl(220 16% 65% / 0.7)",
                      }}
                    >
                      Ask anything…
                    </div>
                  </div>

                  <div
                    style={{
                      textAlign: "center",
                      fontSize: 11,
                      color: "hsl(220 16% 65% / 0.8)",
                      paddingBottom: 10,
                    }}
                  >
                    AI can make mistakes. Verify important information.
                  </div>
                </div>

                {/* Right Workspace Panel */}
                <div
                  className="mock-panel"
                  style={{
                    width: 300,
                    flexShrink: 0,
                    flexDirection: "column",
                    gap: 14,
                    padding: 16,
                    background: "hsl(220 40% 8%)",
                    borderLeft: "1px solid hsl(220 25% 24%)",
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 600 }}>Workspace</div>
                  <div
                    style={{
                      borderRadius: 10,
                      border: "1px solid hsl(38 92% 60% / 0.5)",
                      background: "hsl(38 92% 60% / 0.06)",
                      padding: 14,
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    <div
                      className="mono"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: "0.06em",
                        color: "hsl(38 92% 62%)",
                      }}
                    >
                      <span
                        className="dot"
                        style={{ width: 6, height: 6, background: "hsl(38 92% 60%)" }}
                      />
                      NEEDS YOU
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                      Send the Q3 summary to finance@ — nothing goes out until you say so.
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div
                        style={{
                          height: 36,
                          borderRadius: 8,
                          background: "hsl(38 92% 60%)",
                          color: "hsl(240 60% 8%)",
                          display: "flex",
                          alignItems: "center",
                          padding: "0 12px",
                          fontSize: 13,
                          fontWeight: 500,
                        }}
                      >
                        Send it
                      </div>
                      <div
                        style={{
                          height: 36,
                          borderRadius: 8,
                          background: "hsl(220 25% 14%)",
                          display: "flex",
                          alignItems: "center",
                          padding: "0 12px",
                          fontSize: 13,
                        }}
                      >
                        Show me the draft first
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: "hsl(220 16% 65%)" }}>
                      Nothing has been sent yet.
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div
                      className="mono"
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: "0.06em",
                        color: "hsl(220 16% 65%)",
                      }}
                    >
                      FILES
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 12px",
                        borderRadius: 8,
                        border: "1px solid hsl(220 20% 16%)",
                        background: "hsl(216 45% 4%)",
                      }}
                    >
                      <span
                        className="mono"
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: "2px 5px",
                          borderRadius: 4,
                          background: "hsl(142 71% 45% / 0.15)",
                          color: "hsl(142 71% 55%)",
                        }}
                      >
                        XLSX
                      </span>
                      <span className="mono" style={{ fontSize: 12 }}>
                        q3_vendor_spend.xlsx
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating 3D Cards */}
            <div
              className="float f1"
              style={{
                left: -40,
                top: 120,
                width: 260,
                padding: "14px 16px",
                borderRadius: 10,
                border: "1px solid hsl(220 20% 16%)",
                background: "hsl(220 30% 7% / 0.96)",
                boxShadow: "0 30px 60px -20px rgba(0,0,0,.6)",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div
                className="mono"
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  color: "hsl(220 16% 65%)",
                }}
              >
                CITATION 1
              </div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Northwind_INV_0931.pdf</div>
              <div style={{ fontSize: 12, color: "hsl(220 16% 65%)" }}>Page 2 · Finance / Q3</div>
              <div style={{ display: "flex", gap: 6 }}>
                <span
                  className="mono"
                  style={{
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    padding: "2px 8px",
                    borderRadius: 9999,
                    background: "hsl(142 71% 55% / 0.15)",
                    color: "hsl(142 71% 55%)",
                  }}
                >
                  extracted
                </span>
                <span
                  className="mono"
                  style={{
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    padding: "2px 8px",
                    borderRadius: 9999,
                    border: "1px solid hsl(220 20% 16%)",
                    color: "hsl(220 16% 65%)",
                  }}
                >
                  0.91
                </span>
              </div>
            </div>

            <div
              className="float f2"
              style={{
                right: -30,
                top: -26,
                width: 250,
                padding: "14px 16px",
                borderRadius: 10,
                border: "1px solid hsl(220 20% 16%)",
                background: "hsl(220 30% 7% / 0.96)",
                boxShadow: "0 30px 60px -20px rgba(0,0,0,.6)",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div
                className="mono"
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  color: "hsl(220 16% 65%)",
                }}
              >
                SANDBOX
              </div>
              <div
                className="mono"
                style={{
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: "hsl(226 60% 97%)",
                }}
              >
                df.groupby("vendor")["total"].sum()
                <br />
                wb.save("q3_vendor_spend.xlsx")
              </div>
              <div style={{ fontSize: 12, color: "hsl(142 71% 55%)" }}>
                exit 0 · 1.2s · isolated container
              </div>
            </div>

            <div
              className="float f3"
              style={{
                right: 60,
                bottom: -34,
                width: 280,
                padding: "14px 16px",
                borderRadius: 10,
                border: "1px solid hsl(220 20% 16%)",
                background: "hsl(220 30% 7% / 0.96)",
                boxShadow: "0 30px 60px -20px rgba(0,0,0,.6)",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: "hsl(239 100% 82% / 0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="hsl(239 100% 82%)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ width: 18, height: 18 }}
                >
                  <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Your data, your org only</div>
                <div style={{ fontSize: 12, color: "hsl(220 16% 65%)" }}>
                  Row-level security on every table
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Facts Strip ── */}
      <div className="wrap" style={{ marginTop: 24 }}>
        <div className="card facts" style={{ overflow: "hidden" }}>
          <div>
            <div
              className="hl count"
              style={{
                fontSize: 30,
                fontWeight: 800,
                letterSpacing: "-0.02em",
              }}
            >
              {totalProviders}
            </div>
            <div style={{ fontSize: 13, color: "hsl(220 16% 65%)", marginTop: 4 }}>
              model providers, cloud and local
            </div>
          </div>
          <div>
            <div
              className="hl count"
              style={{
                fontSize: 30,
                fontWeight: 800,
                letterSpacing: "-0.02em",
              }}
            >
              {GAUNTLET_STAGES.length}
            </div>
            <div style={{ fontSize: 13, color: "hsl(220 16% 65%)", marginTop: 4 }}>
              checks a workflow must pass before it publishes
            </div>
          </div>
          <div>
            <div
              className="hl"
              style={{
                fontSize: 30,
                fontWeight: 800,
                letterSpacing: "-0.02em",
              }}
            >
              Every
            </div>
            <div style={{ fontSize: 13, color: "hsl(220 16% 65%)", marginTop: 4 }}>
              outbound action pauses for a person
            </div>
          </div>
          <div>
            <div
              className="hl count"
              style={{
                fontSize: 30,
                fontWeight: 800,
                letterSpacing: "-0.02em",
              }}
            >
              {HERO_FACTS.citationCoverage}
            </div>
            <div style={{ fontSize: 13, color: "hsl(220 16% 65%)", marginTop: 4 }}>
              of tables under row-level security
            </div>
          </div>
        </div>
        <PromoSlot />
      </div>
    </section>
  )
}

// ── Hero promo slot (Phase 276-05, UI-SPEC V4, D-10 / D-15 / G4-2) ──────────────────────────────
// A static frame + poster. It imports NO Remotion code: the promo module arrives by a dynamic
// import of ./HeroPromo only when the reader has scrolled at least once since window load AND the
// slot is at least half visible — so it can never start on first paint, even on a screen tall
// enough to show it without scrolling. Under prefers-reduced-motion it never starts by itself; a
// play button starts it (muted). If the import fails, the poster simply stays.
const PROMO_POSTER = "/docs-assets/posters/landing-promo.jpg"

function PromoSlot() {
  const slotRef = useRef<HTMLElement>(null)
  const requested = useRef(false)
  const [reduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true,
  )
  const [Promo, setPromo] = useState<ComponentType | null>(null)

  const load = useCallback(() => {
    if (requested.current) return
    requested.current = true
    import("./HeroPromo").then(
      (m) => setPromo(() => m.HeroPromo),
      () => {
        requested.current = false // the poster stays; a later scroll or click may try again
      },
    )
  }, [])

  useEffect(() => {
    if (reduced) return
    const el = slotRef.current
    if (!el || typeof IntersectionObserver === "undefined") return
    let scrolled = false
    let visible = false
    let io: IntersectionObserver | null = null
    const maybeStart = () => {
      if (scrolled && visible) {
        load()
        detach()
      }
    }
    const onScroll = () => {
      scrolled = true
      maybeStart()
    }
    const attach = () => {
      window.addEventListener("scroll", onScroll, { passive: true })
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) visible = e.intersectionRatio >= 0.5
          maybeStart()
        },
        { threshold: [0, 0.5] },
      )
      io.observe(el)
    }
    function detach() {
      window.removeEventListener("load", attach)
      window.removeEventListener("scroll", onScroll)
      io?.disconnect()
    }
    if (document.readyState === "complete") attach()
    else window.addEventListener("load", attach, { once: true })
    return detach
  }, [reduced, load])

  return (
    <figure ref={slotRef} className="promo-slot" aria-label="Syrel promo video">
      <div className="promo-frame">
        {Promo ? (
          <Promo />
        ) : (
          <>
            <img className="promo-poster" src={PROMO_POSTER} alt="" loading="lazy" decoding="async" width={1280} height={720} />
            {reduced && (
              <button type="button" className="promo-play" aria-label="Play the Syrel promo" onClick={load}>
                <svg viewBox="0 0 24 24" width={24} height={24} aria-hidden="true" focusable="false">
                  <path d="M8 5v14l11-7z" fill="currentColor" />
                </svg>
              </button>
            )}
          </>
        )}
      </div>
    </figure>
  )
}

import { VERBATIM_QUOTES } from "../facts"

export function QuotesSection() {
  const getQuote = (id: string) => VERBATIM_QUOTES.find((q) => q.id === id)?.quote || ""

  return (
    <section style={{ padding: "0 0 112px", position: "relative", zIndex: 1 }}>
      <div className="wrap">
        <div style={{ maxWidth: 640, marginBottom: 40, display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="eyebrow">In its own words</div>
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
            Copy taken straight from the product.
          </h2>
          <p style={{ margin: 0, fontSize: 17, lineHeight: 1.55, color: "hsl(220 16% 65%)" }}>
            Not marketing lines — the sentences the interface actually shows you.
          </p>
        </div>

        <div className="grid3">
          <blockquote
            className="card"
            style={{
              margin: 0,
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 12,
              borderLeft: "3px solid hsl(38 92% 60%)",
            }}
          >
            <p className="hl" style={{ margin: 0, fontSize: 18, lineHeight: 1.4, fontWeight: 600 }}>
              “{getQuote("ask_paused")}”
            </p>
            <p style={{ margin: 0, fontSize: 14, color: "hsl(220 16% 65%)" }}>
              “{getQuote("ask_nothing_sent")}”
            </p>
            <footer className="mono" style={{ fontSize: 11, color: "hsl(220 16% 65%)" }}>
              — the approval card, before any outbound action
            </footer>
          </blockquote>

          <blockquote
            className="card"
            style={{
              margin: 0,
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 12,
              borderLeft: "3px solid hsl(239 100% 82%)",
            }}
          >
            <p className="hl" style={{ margin: 0, fontSize: 18, lineHeight: 1.4, fontWeight: 600 }}>
              “{getQuote("describe_door")}”
            </p>
            <footer className="mono" style={{ fontSize: 11, color: "hsl(220 16% 65%)" }}>
              — the workflow describe door
            </footer>
          </blockquote>

          <blockquote
            className="card"
            style={{
              margin: 0,
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 12,
              borderLeft: "3px solid hsl(142 71% 45%)",
            }}
          >
            <p className="hl" style={{ margin: 0, fontSize: 18, lineHeight: 1.4, fontWeight: 600 }}>
              “{getQuote("golden_run")}”
            </p>
            <p style={{ margin: 0, fontSize: 14, color: "hsl(220 16% 65%)" }}>
              “{getQuote("independent_judge")}”
            </p>
            <footer className="mono" style={{ fontSize: 11, color: "hsl(220 16% 65%)" }}>
              — two of the publish checks
            </footer>
          </blockquote>

          <blockquote
            className="card"
            style={{
              margin: 0,
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 12,
              borderLeft: "3px solid hsl(258 90% 66%)",
            }}
          >
            <p className="hl" style={{ margin: 0, fontSize: 18, lineHeight: 1.4, fontWeight: 600 }}>
              “Only what you tick can appear in the draft.”
            </p>
            <footer className="mono" style={{ fontSize: 11, color: "hsl(220 16% 65%)" }}>
              — services a workflow may use
            </footer>
          </blockquote>

          <blockquote
            className="card"
            style={{
              margin: 0,
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 12,
              borderLeft: "3px solid hsl(0 72% 51%)",
            }}
          >
            <p className="hl" style={{ margin: 0, fontSize: 18, lineHeight: 1.4, fontWeight: 600 }}>
              “{getQuote("reason_unknown")}”
            </p>
            <footer className="mono" style={{ fontSize: 11, color: "hsl(220 16% 65%)" }}>
              — a run step, when something went wrong
            </footer>
          </blockquote>

          <blockquote
            className="card"
            style={{
              margin: 0,
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 12,
              borderLeft: "3px solid hsl(220 16% 65%)",
            }}
          >
            <p className="hl" style={{ margin: 0, fontSize: 18, lineHeight: 1.4, fontWeight: 600 }}>
              “Shown here only. The record keeps what ran, not what it said.”
            </p>
            <footer className="mono" style={{ fontSize: 11, color: "hsl(220 16% 65%)" }}>
              — the run record, on what is and isn’t stored
            </footer>
          </blockquote>
        </div>
      </div>
    </section>
  )
}

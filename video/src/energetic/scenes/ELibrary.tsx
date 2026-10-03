import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Footnote } from "../../components/ui";
import { body, C, display } from "../../theme";
import { ECaption, EPanel, PushIn, Sfx, SFX, Vo } from "../kit";
import { F_STAGGER, pop, punch } from "../theme";
import type { SceneProps } from "./EOpening";

// Shipped Library surfaces only (v3.0): folders, saved views ("virtual folders") with relative
// dates, per-field metadata with a confidence chip, citations. Find and file download are v4.5 —
// NOT released, so they are not shown here.
const FOLDERS = [
  { name: "Board", depth: 0 },
  { name: "Finance", depth: 0 },
  { name: "Q3 reports", depth: 1 },
  { name: "Legal", depth: 0 },
  { name: "Contracts", depth: 1 },
];
const DOCS = [
  { name: "Supplier-Agreement-Northwind.pdf", type: "Contract", date: "Renews in 41 days", conf: "High", keep: true },
  { name: "Q3-Board-Pack.pptx", type: "Presentation", date: "Updated 3 days ago", conf: "High", keep: false },
  { name: "Lease-Office-Dubai.docx", type: "Contract", date: "Renews in 77 days", conf: "Medium", keep: true },
  { name: "Churn-by-Segment.xlsx", type: "Spreadsheet", date: "Updated 2 weeks ago", conf: "High", keep: false },
  { name: "NDA-Contoso.pdf", type: "Contract", date: "Renews in 12 days", conf: "High", keep: true },
];
const CONF_COLOR: Record<string, string> = { High: C.success, Medium: C.warn };

const FIRST = 12;
const VIEW_AT = 58; // saved view applies: non-matching rows leave

export const ELibrary: React.FC<SceneProps> = ({ duration, vo }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const view = pop(frame, VIEW_AT, fps);
  const filtered = frame >= VIEW_AT + 4;

  return (
    <PushIn duration={duration}>
      <Vo beat={0} file={vo} />
      <Sfx at={0} src={SFX.whoosh} volume={0.35} />
      <Sfx at={VIEW_AT} src={SFX.toggle} volume={0.4} />
      <AbsoluteFill>
        <ECaption
          eyebrow="Library"
          lines={["Your documents,", "*organised.*"]}
          sub="Folders, saved views and metadata with honest confidence — and every answer cites the page."
        />
        <EPanel at={4} style={{ left: 880, top: 170, width: 900, padding: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", minHeight: 540 }}>
            {/* Folder tree */}
            <div style={{ width: 250, padding: "28px 18px", borderRight: `1px solid ${C.border}`, background: "hsl(220 40% 5% / 0.6)" }}>
              <div style={{ fontFamily: body, fontSize: 15, letterSpacing: 2, textTransform: "uppercase", color: C.dim, marginBottom: 12 }}>Folders</div>
              {FOLDERS.map((f, i) => {
                const p = punch(frame, FIRST + i * F_STAGGER, 6);
                return (
                  <div
                    key={f.name}
                    style={{
                      fontFamily: body,
                      fontSize: 20,
                      color: C.muted,
                      padding: "8px 10px",
                      paddingLeft: 10 + f.depth * 22,
                      opacity: p,
                      translate: `${(1 - p) * -20}px 0px`,
                    }}
                  >
                    {f.depth ? "└ " : "▸ "}
                    {f.name}
                  </div>
                );
              })}
              <div style={{ fontFamily: body, fontSize: 15, letterSpacing: 2, textTransform: "uppercase", color: C.dim, margin: "22px 0 10px" }}>Views</div>
              <div
                style={{
                  fontFamily: body,
                  fontSize: 19,
                  fontWeight: 600,
                  padding: "9px 12px",
                  borderRadius: 10,
                  color: filtered ? C.primary : C.muted,
                  background: filtered ? "hsl(239 100% 82% / 0.14)" : "transparent",
                  border: `1px solid ${filtered ? "hsl(239 100% 82% / 0.45)" : "transparent"}`,
                  scale: frame >= VIEW_AT ? view : 1,
                }}
              >
                ◆ Contracts renewing in 90 days
              </div>
            </div>
            {/* Documents */}
            <div style={{ flex: 1, padding: "26px 26px" }}>
              <div style={{ fontFamily: display, fontSize: 24, fontWeight: 700, color: C.fg, marginBottom: 16 }}>
                {filtered ? "Contracts renewing in 90 days" : "All documents"}
                <span style={{ fontFamily: body, fontSize: 17, fontWeight: 500, color: C.dim, marginLeft: 12 }}>
                  {filtered ? "3 documents" : "5 documents"}
                </span>
              </div>
              {DOCS.map((d, i) => {
                const enter = punch(frame, FIRST + 6 + i * F_STAGGER, 6);
                const leave = !d.keep ? interpolate(frame, [VIEW_AT, VIEW_AT + 6], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
                const h = !d.keep ? interpolate(frame, [VIEW_AT + 2, VIEW_AT + 10], [96, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 96;
                const chip = pop(frame, VIEW_AT + 14 + i * 2, fps);
                return (
                  <div key={d.name} style={{ height: h, overflow: "hidden", opacity: enter * leave }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        padding: "14px 16px",
                        marginBottom: 10,
                        borderRadius: 14,
                        background: C.cardRaised,
                        border: `1px solid ${C.border}`,
                        translate: `${(1 - enter) * 30}px 0px`,
                      }}
                    >
                      <div>
                        <div style={{ fontFamily: body, fontSize: 20, fontWeight: 600, color: C.fg }}>{d.name}</div>
                        <div style={{ fontFamily: body, fontSize: 16, color: C.muted, marginTop: 4 }}>
                          {d.type} · {d.date}
                        </div>
                      </div>
                      {filtered && d.keep ? (
                        <div
                          style={{
                            fontFamily: body,
                            fontSize: 15,
                            fontWeight: 700,
                            color: CONF_COLOR[d.conf],
                            border: `1px solid ${CONF_COLOR[d.conf].replace(")", " / 0.4)")}`,
                            background: CONF_COLOR[d.conf].replace(")", " / 0.12)"),
                            borderRadius: 999,
                            padding: "5px 12px",
                            whiteSpace: "nowrap",
                            scale: chip,
                            opacity: Math.min(1, chip),
                          }}
                        >
                          ● {d.conf} confidence
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </EPanel>
        <Footnote>Illustrative example</Footnote>
      </AbsoluteFill>
    </PushIn>
  );
};

import React from "react";
import { body, C, display } from "../theme";
import { Check } from "../components/ui";

// Compact product cards for the promo — truthful, shipped surfaces only (docs/history "Still true").
// Fixed 720 px wide; callers scale them.

const card: React.CSSProperties = {
  width: 720,
  borderRadius: 26,
  padding: "28px 32px",
  background: `linear-gradient(180deg, ${C.cardRaised}, ${C.card})`,
  border: `1px solid hsl(239 100% 82% / 0.25)`,
  boxShadow: "0 40px 120px hsl(240 80% 3% / 0.8), inset 0 1px 0 hsl(226 60% 97% / 0.06)",
  fontFamily: body,
  color: C.fg,
};
const label: React.CSSProperties = { fontFamily: display, fontWeight: 700, fontSize: 20, color: C.muted, marginBottom: 16 };
const chip = (color: string): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 14px",
  borderRadius: 999,
  fontSize: 18,
  fontWeight: 700,
  color,
  border: `1px solid ${color.replace(")", " / 0.4)")}`,
  background: color.replace(")", " / 0.12)"),
});

export const ChatCard: React.FC<{ cites?: number }> = ({ cites = 3 }) => (
  <div style={card}>
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 18 }}>
      <div style={{ padding: "14px 20px", borderRadius: 18, background: "hsl(239 100% 82% / 0.14)", fontSize: 22 }}>
        What drove Q3 churn?
      </div>
    </div>
    <div style={{ fontSize: 24, lineHeight: 1.5 }}>
      Onboarding friction in the first 30 days
      {cites >= 1 ? <Sup n={1} /> : null}, mostly in the SMB tier{cites >= 2 ? <Sup n={2} /> : null}.
    </div>
    <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
      {cites >= 3 ? <span style={chip(C.success)}>● High confidence</span> : null}
      {cites >= 1 ? <span style={chip(C.muted)}>1 · Retention-Report.pdf p.4</span> : null}
    </div>
  </div>
);
const Sup: React.FC<{ n: number }> = ({ n }) => (
  <sup style={{ marginLeft: 6, padding: "1px 8px", borderRadius: 7, fontSize: 15, fontWeight: 800, color: C.bg, background: C.primary }}>{n}</sup>
);

export const WorkflowCard: React.FC<{ lit: number }> = ({ lit }) => {
  const steps = ["Gather evidence", "Analyse", "Draft report", "Validate citations", "Deliver .docx"];
  return (
    <div style={card}>
      <div style={label}>Workflow · Quarterly board update</div>
      {steps.map((s, i) => (
        <div key={s} style={{ display: "flex", alignItems: "center", gap: 18, height: 58 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              border: `2px solid ${i < lit ? C.success : C.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: i === lit - 1 ? `0 0 24px ${C.success}` : undefined,
            }}
          >
            {i < lit ? <Check progress={1} size={26} /> : null}
          </div>
          <span style={{ fontSize: 24, fontWeight: 600, color: i < lit ? C.fg : C.dim }}>{s}</span>
        </div>
      ))}
    </div>
  );
};

export const ChecksCard: React.FC<{ passed: number; total: number }> = ({ passed, total }) => (
  <div style={{ ...card, width: 820 }}>
    <div style={label}>Publish checks</div>
    <div style={{ display: "flex", gap: 10 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{ flex: 1, height: 18, borderRadius: 9, background: i < passed ? C.success : C.border, boxShadow: i === passed - 1 ? `0 0 18px ${C.success}` : undefined }} />
      ))}
    </div>
    <div style={{ marginTop: 18, fontSize: 22, color: passed === total ? C.success : C.muted, fontWeight: 700 }}>
      {passed === total ? `${total} / ${total} passed · Published` : `${passed} / ${total}`}
    </div>
  </div>
);

export const TILE_NAMES = ["Drive", "Gmail", "Calendar", "Sheets", "Jira", "MCP"];
export const Tile: React.FC<{ name: string }> = ({ name }) => (
  <div
    style={{
      width: 150,
      height: 150,
      borderRadius: 34,
      background: C.cardRaised,
      border: "1px solid hsl(239 100% 82% / 0.3)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      boxShadow: "0 30px 80px hsl(240 80% 3% / 0.7)",
    }}
  >
    <div style={{ fontFamily: display, fontWeight: 800, fontSize: name === "MCP" ? 34 : 42, color: C.fg }}>{name === "MCP" ? "MCP" : name.slice(0, 2)}</div>
    <div style={{ fontFamily: body, fontSize: 17, color: C.muted }}>{name}</div>
  </div>
);

export const GRANTS: Array<[string, "Allow" | "Ask" | "Deny"]> = [
  ["drive.search_files", "Allow"],
  ["gmail.send_message", "Ask"],
  ["jira.delete_issue", "Deny"],
];
const GRANT_COLOR = { Allow: C.success, Ask: C.warn, Deny: C.danger };
export const GrantRow: React.FC<{ tool: string; mode: "Allow" | "Ask" | "Deny" }> = ({ tool, mode }) => (
  <div style={{ ...card, width: 760, padding: "20px 28px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
    <span style={{ fontFamily: "ui-monospace, Consolas, monospace", fontSize: 26 }}>{tool}</span>
    <span style={{ ...chip(GRANT_COLOR[mode]), fontSize: 24, padding: "8px 20px" }}>{mode}</span>
  </div>
);

export const EXPERT_NAMES = ["Financial Analyzer", "Contract Reviewer", "HR Policy Advisor", "Operations Analyst", "Security & Compliance"];
export const ExpertCard: React.FC<{ name: string; compact?: boolean }> = ({ name, compact = false }) => (
  <div
    style={{
      ...card,
      width: compact ? 720 : 300,
      padding: compact ? "16px 22px" : "22px 22px",
      display: "flex",
      flexDirection: compact ? "row" : "column",
      alignItems: compact ? "center" : "flex-start",
      gap: 14,
    }}
  >
    <div
      style={{
        width: 64,
        height: 64,
        borderRadius: 18,
        background: "linear-gradient(135deg, hsl(239 100% 82% / 0.3), hsl(258 90% 66% / 0.3))",
        border: "1px solid hsl(239 100% 82% / 0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: display,
        fontWeight: 800,
        fontSize: 24,
        color: C.primary,
      }}
    >
      {name
        .split(/[\s&]+/)
        .filter(Boolean)
        .map((w) => w[0])
        .join("")
        .slice(0, 2)}
    </div>
    <div style={{ fontFamily: display, fontWeight: 800, fontSize: compact ? 30 : 24, flex: compact ? 1 : undefined }}>{name}</div>
    <span style={chip(C.success)}>Install</span>
  </div>
);

/**
 * Phase 227 Wave 2 — StepRow and ToolEssenceLine components.
 *
 * Encapsulates the timeline rail spine and essence card presentation:
 *   - StepRow: 2-column grid (rail column with node, line, and step number + main content column)
 *   - ToolEssenceLine: 1-line essence card button with icon, label, result summary, status pill, and chevron
 *
 * SC#3 preparation: Right-aligning the result column in a future phase is localized
 * entirely within StepRow.tsx (the flex layout of ToolEssenceLine).
 */
import React from "react"
import {
  ChevronRight, Search, Globe, Database, FileText, Wrench,
  FolderOpen, GitBranch, TextSearch, FileSearch,
  BookOpen, Terminal,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { ToolCall } from "@/types"
import { toolLabel, toolSummary as getToolSummary } from "@/lib/toolMeta"
import { preparingDescription } from "@/lib/providerLogo"
import { StatusPill, type ToolStatus } from "./StatusPill"
import { ConnectionMarkGlyph } from "@/lib/connectionMark"
import { summarizeToolCall } from "./tool-bodies"

export type NodeState = "done" | "active" | "queued"

export function toolIcon(name: string) {
  const cls = "w-3.5 h-3.5"
  if (name.includes("__")) {
    const serviceId = name.split("__")[0]
    return <ConnectionMarkGlyph shape={{ service_id: serviceId }} size="chip" />
  }
  if (name === "search_documents") return <Search className={cls} />
  if (name === "query_documents") return <Database className={cls} />
  if (name === "web_search") return <Globe className={cls} />
  if (name === "analyze_document") return <FileText className={cls} />
  if (name === "ls") return <FolderOpen className={cls} />
  if (name === "tree") return <GitBranch className={cls} />
  if (name === "grep") return <TextSearch className={cls} />
  if (name === "glob") return <FileSearch className={cls} />
  if (name === "read_document") return <BookOpen className={cls} />
  if (name === "execute_code") return <Terminal className={cls} />
  return <Wrench className={cls} />
}

export function toolIconColor(name: string, status: string) {
  if (status === "running") return "text-primary"
  if (status === "interrupted") return "text-amber-400"
  if (name === "web_search") return "text-amber-400"
  if (name === "query_documents") return "text-emerald-400"
  if (name === "search_documents") return "text-primary"
  if (name === "analyze_document") return "text-violet-400"
  if (name === "execute_code") return "text-blue-400"
  return "text-muted-foreground"
}

export function toolSummary(tc: ToolCall) {
  return getToolSummary(tc.name, tc.args)
}

// Phase 075.8 Task 2 (sketch 002 D5): map ToolCall.status → StatusPill ToolStatus.
// "failed" is not directly observable on ToolCall.status (failed execute_code
// surfaces through ExecuteCodeBody's exitCode path; non-execute_code tools
// surface errors via parsed.error). Treat anything terminal-but-not-done as
// done — failures show up via ToolResultBlock's destructive italic line.
export function pillStatus(s: ToolCall["status"]): ToolStatus {
  if (s === "preparing") return "preparing"
  if (s === "running") return "running"
  if (s === "interrupted") return "interrupted"
  return "done"
}

// Phase 075.8 Task 2 (sketch 002 D5): TimeBadge was dropped — the StatusPill
// now carries the `· {duration}` suffix on done/failed/interrupted variants,
// making the standalone Clock+duration span redundant. ExecuteCodeBody
// underwent the same swap.

// ---- Essence line (Phase 095 Plan 06, sketch 014 — GAP-095-03 essence) ----
//   {icon} {tool} → {result} {pill} {chev}
// The resting text is the RESULT (summarizeToolCall), NOT the args summary —
// "finished essence recedes" so the result uses text-muted-foreground. The
// whole row is the click target that expands this card's full body. Replaces
// the prior two-row resting state (head row with args-in-quotes + a SEPARATE
// ToolResultBlock result row) with a single essence line. Used for every
// non-execute_code finished tool; execute_code reuses it for its done resting
// line so a done code card shows ONE result-bearing line, not args + a
// separate result row.
// SEED-098 Change 1: the essence line is now the resting shape for ACTIVE
// (running/preparing) tools too, not just finished ones — so an active tool
// rests as the SAME calm one-line shape (no auto-expanded heavy body, no
// show→collapse flicker), with its live body one click behind the chevron.
//   • running   → `Running {tool}` (primary) + optional ` "{summary}"`; right
//     pill = the Variant B merged live chip (verb · live duration in ONE chip).
//   • preparing → `Preparing {tool}…` + preparingDescription suffix; right pill
//     = `preparing` (or `preparing · X.X KB` when argsBytesStreamed > 0).
//   • done/interrupted → UNCHANGED: `{tool} → {result}` + done pill w/ duration.
export function ToolEssenceLine({
  tc,
  onExpand,
}: {
  tc: ToolCall
  onExpand: () => void
}) {
  const isRunning = tc.status === "running"
  const isPreparing = tc.status === "preparing"
  const isActive = isRunning || isPreparing
  const result = summarizeToolCall(tc) || "View results"
  const summary = toolSummary(tc)
  return (
    <button
      type="button"
      onClick={onExpand}
      // Finished essence keeps the historical testid; the active essence is
      // reachable via its inner StatusPill (data-testid="status-pill").
      data-testid={isActive ? undefined : "tool-result-summary"}
      aria-label="Expand this step"
      className="w-full flex items-center gap-2.5 text-left group"
    >
      <span
        className={cn(
          "flex-shrink-0 p-1 rounded-md bg-muted/50 transition-colors duration-300",
          toolIconColor(tc.name, tc.status),
          isPreparing && "opacity-50",
        )}
      >
        {toolIcon(tc.name)}
      </span>
      <span className="flex-1 min-w-0 text-xs truncate">
        {isPreparing ? (
          <span className="font-semibold text-foreground/50 italic">
            Preparing {toolLabel(tc.name)}…
            {(() => {
              const prepDesc = preparingDescription(tc)
              return prepDesc ? (
                <span className="ml-1 font-normal text-foreground/60 not-italic">
                  {" "}— {prepDesc}
                </span>
              ) : null
            })()}
          </span>
        ) : isRunning ? (
          <>
            <span className="font-semibold text-primary">Running {toolLabel(tc.name)}</span>
            {summary && <span className="ml-1.5 opacity-50">"{summary}"</span>}
          </>
        ) : (
          <>
            <span className="font-semibold text-foreground/80">{toolLabel(tc.name)}</span>
            <span className="mx-1 text-muted-foreground">→</span>
            <span className="text-muted-foreground">{result}</span>
          </>
        )}
      </span>
      {isPreparing ? (
        <StatusPill
          status="preparing"
          runningLabel={
            tc.argsBytesStreamed != null && tc.argsBytesStreamed > 0
              ? `preparing · ${(tc.argsBytesStreamed / 1024).toFixed(1)} KB`
              : undefined
          }
        />
      ) : isRunning ? (
        // The Variant B merged live chip — verb + live ticking duration in ONE
        // chip; no separate ElapsedTimer span on the active essence row.
        <StatusPill status="running" liveStartedAt={tc.startedAt ?? undefined} />
      ) : (
        /* ── ⚠ NOISE AUDIT 2026-08-31 (operator, item A6) ────────────────────────
              A green `DONE` on every row of a run whose own header already says
              `✓ done` is a column of identical stickers. Measured: a two-step run showed
              `DONE` twice under one `✓ done`, and the pills were the only colour on the
              list — so the eye went to the least informative thing on it.

              ⚠ SUCCESS IS THE DEFAULT AND DEFAULTS ARE NOT WORTH SAYING; A FAILURE IS NOT.
              `failed` and `interrupted` keep their pill, loudly, because those are the
              rows a person is scanning FOR and the run header cannot say WHICH step it
              was. The duration goes with the pill on a plain success — it is already in
              the run's own elapsed, and a per-step timing belongs to the expanded body. */
        pillStatus(tc.status) !== "done" && (
          <StatusPill
            status={pillStatus(tc.status)}
            duration={
              tc.startedAt != null && tc.endedAt != null ? tc.endedAt - tc.startedAt : undefined
            }
          />
        )
      )}
      <ChevronRight className="w-3 h-3 text-muted-foreground/40 flex-shrink-0 transition-transform group-hover:translate-x-0.5" />
    </button>
  )
}

// ---- Step rail (Phase 095 Plan 03 Task 2, sketch 014 — unified-card-frame) ----

export function StepRow({
  snum,
  node,
  isLast,
  children,
}: {
  snum: number
  node: NodeState
  isLast: boolean
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[28px_1fr] min-w-0">
      {/* Rail column: connecting line + status node + step number */}
      <div className="relative flex flex-col items-center" aria-hidden="true">
        {/* the spine — fills success up to the active node; hidden on the last row */}
        {!isLast && (
          <div
            data-testid="step-rail-line"
            className={cn(
              "absolute top-5 bottom-0 w-px left-1/2 -translate-x-1/2",
              node === "queued" ? "bg-border" : "bg-success/60",
              node === "active" && "bg-gradient-to-b from-success/60 to-primary",
            )}
          />
        )}
        {/* the status node */}
        <span
          data-testid="step-node"
          data-node-state={node}
          className={cn(
            "relative z-[1] mt-2.5 w-2.5 h-2.5 rounded-full border-2 flex-shrink-0",
            node === "done" && "bg-success border-success",
            node === "active" &&
              "bg-card border-primary animate-pulseGlow shadow-[0_0_0_3px_hsl(var(--primary)/0.15)]",
            node === "queued" && "bg-card border-border",
          )}
        />
        {/* the step number */}
        <span
          data-testid="step-snum"
          className={cn(
            "mt-1 font-mono text-[10px] tabular-nums leading-none",
            node === "active" ? "text-primary font-bold" : "text-success/80",
            node === "queued" && "text-muted-foreground",
          )}
        >
          {snum}
        </span>
      </div>
      {/* Step main column: the reused per-tool head + body */}
      <div className="min-w-0">{children}</div>
    </div>
  )
}

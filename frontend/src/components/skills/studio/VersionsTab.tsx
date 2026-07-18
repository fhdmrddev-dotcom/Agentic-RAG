// ─────────────────────────────────────────────────────────────────────────────
// Phase 137 Plan 02 (PANEL-01 / VER-01 / D-05) — the Studio Versions tab.
//
// Sketch 056-B: a scan-first version TABLE (version · origin chip · eval-on-this-
// version binding · date, with the live version LIVE-badged) plus an explicit
// any-to-any Compare v[x] ↔ v[y] picker that renders ONE unified diff via the 135
// `lineDiff` util (add=emerald / remove=destructive / context=foreground/70).
//
// The two "bindings" are CLIENT-SIDE JOINS over already-shipped, owner-scoped
// endpoints — zero backend change, no migration (D-15, RESEARCH Pitfall 2):
//   (a) version → eval rollup: group listEvalRuns() by EvalRun.skill_version_id,
//       surface each version's latest run's passed/measured rollup (or "never
//       evaled"). The rollup lives on the EVAL side, NOT the versions endpoint.
//   (b) version → forced-proposal: match listProposals() rows where
//       proposal.new_skill_version_id === version.id && override_forced, and carry
//       that proposal's un-softened failed PromotionGate as evidence.
//
// PROVENANCE (RESEARCH Pitfall 1): the real SkillVersion.source CHECK enum is
// manual / import / tuner / self_improve / backfill — there is no override source
// value. A force-promoted version still reads source = self_improve; the override
// fact lives on the proposal (override_forced), surfaced via join (b) above.
//
// A roll-back / re-apply affordance is deliberately ABSENT (versions immutable —
// VER-01 / D-05). All text (instructions, diff rows) renders as React text nodes
// only (never raw HTML injection).
// Owner-scoping is the server's sole runtime gate; this tab passes only skillId.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import { listSkillVersions, listEvalRuns, listProposals } from "@/lib/api"
import { lineDiff } from "@/lib/lineDiff"
import type { SkillVersion, EvalRun, SkillProposal, PromotionGate } from "@/types"

interface Props {
  skillId: string
  /** The live version number, supplied by the Studio shell (Plan 06). This tab is
   *  a pure renderer of the LIVE badge — it never derives which version is live. */
  liveVersionNumber: number
}

// ── Provenance chip: EXACTLY the five real SkillVersion.source values (Pitfall 1).
//    No override-source branch — that would be dead code (the fact is on the proposal row).
function provenanceChip(source: string): { label: string; className: string } {
  switch (source) {
    case "manual":
      return { label: "hand-edited", className: "bg-muted text-muted-foreground" }
    case "import":
      return { label: "imported", className: "bg-muted text-muted-foreground" }
    case "tuner":
      return { label: "tuner-promoted", className: "bg-sky-500/10 text-sky-600 dark:text-sky-400" }
    case "self_improve":
      return { label: "proposal-promoted", className: "bg-primary/10 text-primary" }
    case "backfill":
      return { label: "original", className: "bg-muted text-muted-foreground" }
    default:
      // Defensive: render the raw source verbatim rather than fabricate a label.
      return { label: source, className: "bg-muted text-muted-foreground" }
  }
}

// ── Eval-on-this-version binding (join a): the version's LATEST run rollup.
type EvalTone = "pass" | "fail" | "mixed" | "none"
function bindingFor(version: SkillVersion, runs: EvalRun[]): { text: string; tone: EvalTone } {
  const mine = runs.filter((r) => r.skill_version_id === version.id)
  if (mine.length === 0) return { text: "never evaled", tone: "none" }
  // Latest by created_at (listEvalRuns is newest-first, but sort defensively).
  const latest = [...mine].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )[0]
  if (latest.measured_count == null) {
    // Pre-081 run or an error/cancel path with no honest rollup — never fabricate one.
    const text = latest.status === "completed" ? `evaled · ${latest.model}` : `run ${latest.status}`
    return { text, tone: "none" }
  }
  const measured = latest.measured_count
  const passed = latest.passed_count ?? 0
  const tone: EvalTone =
    measured > 0 && passed === measured ? "pass" : passed === 0 ? "fail" : "mixed"
  return { text: `${passed}/${measured} passed · ${latest.model}`, tone }
}

const EVAL_TONE_CLASS: Record<EvalTone, string> = {
  pass: "text-emerald-600 dark:text-emerald-400",
  fail: "text-destructive",
  mixed: "text-amber-600 dark:text-amber-400",
  none: "text-muted-foreground",
}

// ── Forced-proposal join (b): the un-softened failed-gate evidence for a version.
function forcedFor(version: SkillVersion, proposals: SkillProposal[]): SkillProposal | null {
  return (
    proposals.find((p) => p.new_skill_version_id === version.id && p.override_forced) ?? null
  )
}

function GateEvidence({ gate }: { gate: PromotionGate }) {
  const rows: { label: string; value: string; bad?: boolean }[] = [
    { label: "no regression", value: gate.no_regression ? "yes" : "NO", bad: !gate.no_regression },
    { label: "newly passing", value: `+${gate.newly_pass}` },
    { label: "still passing", value: `${gate.still_pass}`, bad: gate.still_pass < gate.prev_pass },
    { label: "excluded (not measured)", value: `${gate.excluded_not_measured}` },
  ]
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2">
      {rows.map((r) => (
        <div key={r.label} className="text-[9px] uppercase tracking-wide text-muted-foreground">
          {r.label}
          <span
            className={`mt-0.5 block font-mono text-xs ${r.bad ? "text-destructive" : "text-foreground"}`}
          >
            {r.value}
          </span>
        </div>
      ))}
    </div>
  )
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export function VersionsTab({ skillId, liveVersionNumber }: Props) {
  const [versions, setVersions] = useState<SkillVersion[]>([])
  const [runs, setRuns] = useState<EvalRun[]>([])
  const [proposals, setProposals] = useState<SkillProposal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Compare picker selection (version ids). Seeded to newest two on load.
  const [fromId, setFromId] = useState<string>("")
  const [toId, setToId] = useState<string>("")

  // Skill-switch guard (BUG-260701-02 pattern, T-137-02): capture the requested
  // skill; any in-flight fetch bails before setState if the active skill changed.
  const currentSkillRef = useRef(skillId)

  useEffect(() => {
    currentSkillRef.current = skillId
    const requested = skillId
    setLoading(true)
    setError(null)
    Promise.all([listSkillVersions(skillId), listEvalRuns(skillId), listProposals(skillId)])
      .then(([v, r, p]) => {
        if (currentSkillRef.current !== requested) return
        setVersions(v)
        setRuns(r)
        setProposals(p)
        // Seed the compare picker: from = previous, to = newest (v[1] ↔ v[0]).
        if (v.length >= 2) {
          setFromId(v[1].id)
          setToId(v[0].id)
        } else if (v.length === 1) {
          setFromId(v[0].id)
          setToId(v[0].id)
        }
      })
      .catch((e) => {
        if (currentSkillRef.current !== requested) return
        setError(e instanceof Error ? e.message : "Failed to load version history.")
      })
      .finally(() => {
        if (currentSkillRef.current !== requested) return
        setLoading(false)
      })
  }, [skillId])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading version history…
      </div>
    )
  }

  if (error) {
    return <p className="text-xs text-destructive">{error}</p>
  }

  if (versions.length === 0) {
    return <p className="text-xs text-muted-foreground">No versions yet.</p>
  }

  const fromV = versions.find((v) => v.id === fromId) ?? null
  const toV = versions.find((v) => v.id === toId) ?? null

  return (
    <div className="flex flex-col gap-5">
      {/* 056-B scan-first version table */}
      <div className="overflow-x-auto rounded-lg border border-border/60">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-left text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                Version
              </th>
              <th className="px-3 py-2 text-left text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                Origin
              </th>
              <th className="px-3 py-2 text-left text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                Eval on this version
              </th>
              <th className="px-3 py-2 text-left text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                Date
              </th>
            </tr>
          </thead>
          <tbody>
            {versions.map((v) => {
              const chip = provenanceChip(v.source)
              const binding = bindingFor(v, runs)
              const forced = forcedFor(v, proposals)
              const isLive = v.version_number === liveVersionNumber
              return (
                <tr key={v.id} className="border-b border-border/40 align-top last:border-0">
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2">
                      <span className="font-mono font-bold text-foreground">v{v.version_number}</span>
                      {isLive && (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold tracking-wide text-emerald-600 dark:text-emerald-400">
                          LIVE
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${chip.className}`}>
                      {chip.label}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`font-mono text-[10px] ${EVAL_TONE_CLASS[binding.tone]}`}>
                      {binding.text}
                    </span>
                    {forced && (
                      <div className="mt-1.5 flex flex-col gap-1">
                        <span className="text-[9px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                          Force-promoted — gate failed, promoted anyway (override recorded)
                        </span>
                        {forced.gate && !forced.gate.passed && <GateEvidence gate={forced.gate} />}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-[10px] text-muted-foreground">{fmtDate(v.created_at)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Any-to-any Compare v[x] ↔ v[y] picker → ONE unified lineDiff */}
      {versions.length >= 2 ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Compare</span>
            <select
              aria-label="Compare from version"
              value={fromId}
              onChange={(e) => setFromId(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1 font-mono text-xs text-foreground"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.version_number}
                </option>
              ))}
            </select>
            <span aria-hidden="true">↔</span>
            <select
              aria-label="Compare to version"
              value={toId}
              onChange={(e) => setToId(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1 font-mono text-xs text-foreground"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.version_number}
                </option>
              ))}
            </select>
          </div>

          {fromV && toV && (
            <div className="overflow-x-auto rounded-md border border-border/60 bg-muted/20">
              <div className="border-b border-border/60 px-3 py-1.5 text-[9px] text-muted-foreground">
                v{fromV.version_number} → v{toV.version_number} · instructions
              </div>
              <pre className="whitespace-pre-wrap break-words px-3 py-2 font-mono text-[10px] leading-relaxed">
                {lineDiff(fromV.instructions, toV.instructions).map((row, i) => (
                  <span
                    key={i}
                    data-diff-type={row.type}
                    className={
                      row.type === "add"
                        ? "block bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : row.type === "remove"
                          ? "block bg-destructive/10 text-destructive"
                          : "block text-foreground/70"
                    }
                  >
                    {row.type === "add" ? "+ " : row.type === "remove" ? "- " : "  "}
                    {row.text || " "}
                  </span>
                ))}
              </pre>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Only one version so far — nothing to compare yet.
        </p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 137 Plan 06 (PANEL-01 / D-01 / D-03 / D-05) — the Skill Studio shell.
//
// The focused full-surface (sketch 053-A + 057-A): a PERSISTENT header on every tab
// (‹ Skills back · skill name · v{N} · LIVE badge · a condensed one-line gate strip)
// over three deep-linkable tabs — Evals (landing) · Triggering · Versions. Mirrors the
// shipped SkillTunerPage ActiveView precedent (no router). The legacy skill-tuner
// ActiveView redirects here (App.tsx) so no orphan Tuner surface remains.
//
// Two single-source invariants owned HERE (never re-derived by a consumer):
//   • liveVersionNumber = deriveLiveVersion(skill, versions) — the shared W1 helper
//     (content-equality with the live skill). Threaded to the header, the strip,
//     EvalsTab, and VersionsTab so all four agree; Plan 07's panel imports the SAME rule.
//   • caseCount = the shell's listTestCases length — the SAME server list EvalsTab reads
//     (Plan 01 contract), so the header strip and the Evals body cannot structurally
//     diverge. Never a hardcoded 0.
//
// The header gate strip is `LifecycleStepper variant="strip"` fed the SAME server
// getPublishGate response the EvalsTab stepper renders — a pure condensation, never a
// second truth-teller (T-137-01: `met` is never recomputed here).
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useSkills } from "@/hooks/useSkills"
import { getPublishGate, listSkillVersions, listTestCases } from "@/lib/api"
import { deriveLiveVersion } from "@/lib/skillVersion"
import { LifecycleStepper } from "@/components/skills/studio/LifecycleStepper"
import { EvalsTab } from "@/components/skills/studio/EvalsTab"
import { TriggeringTab } from "@/components/skills/studio/TriggeringTab"
import { VersionsTab } from "@/components/skills/studio/VersionsTab"
import type { PublishGate, Skill, SkillVersion, TestCase } from "@/types"

export type StudioTab = "evals" | "triggering" | "versions"

interface Props {
  /** The skill under study. App holds this selection (per-view state); a null id →
   *  the calm guard (opened without a target). */
  skillId: string | null
  /** The active tab (deep-linkable via the App-held studioTab param). */
  tab: StudioTab
  /** Switch the active tab (deep-linkable — App updates studioTab). */
  onTabChange: (tab: StudioTab) => void
  /** Return to the 3-pane Skills surface ("‹ Skills"), preserving selection. */
  onBack: () => void
}

const TABS: { id: StudioTab; label: string }[] = [
  { id: "evals", label: "Evals" },
  { id: "triggering", label: "Triggering" },
  { id: "versions", label: "Versions" },
]

export function SkillStudioPage({ skillId, tab, onTabChange, onBack }: Props) {
  // Reuse useSkills so the header identity is the SAME owner-scoped skill list the
  // rest of the Skills surface reads.
  const { skills } = useSkills()
  const skill: Skill | null = useMemo(
    () => skills.find((s) => s.id === skillId) ?? null,
    [skills, skillId],
  )

  // ── Shell-level reads: the gate (strip source-of-truth), the versions (live-version
  //    derivation), and the cases (strip caseCount). Fetched ONCE per skill switch. ──
  const [gate, setGate] = useState<PublishGate | null>(null)
  const [versions, setVersions] = useState<SkillVersion[]>([])
  const [cases, setCases] = useState<TestCase[]>([])
  const currentSkillRef = useRef(skillId)

  useEffect(() => {
    currentSkillRef.current = skillId
    // Reset on skill switch (no prior skill's gate/versions/cases leak — T-137-02).
    setGate(null)
    setVersions([])
    setCases([])
    if (!skillId) return
    const requested = skillId
    let cancelled = false
    const alive = () => !cancelled && currentSkillRef.current === requested
    // Each read is independent + skill-switch-guarded; a single failure never nukes the others.
    getPublishGate(skillId)
      .then((g) => alive() && setGate(g))
      .catch(() => {})
    listSkillVersions(skillId)
      .then((v) => alive() && setVersions(v))
      .catch(() => {})
    listTestCases(skillId)
      .then((c) => alive() && setCases(c))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [skillId])

  // Re-pull the strip's gate on demand (skill-switch-guarded). EvalsTab calls this when
  // a run finalizes so the header strip updates without a page reload (137-UAT gap).
  const refreshGate = useCallback(() => {
    const requested = skillId
    if (!requested) return
    getPublishGate(requested)
      .then((g) => {
        if (currentSkillRef.current === requested) setGate(g)
      })
      .catch(() => {})
  }, [skillId])

  // skillId null → a calm centered guard with a "‹ Skills" back (the SkillTunerPage pattern).
  if (!skillId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <Sparkles className="h-10 w-10 text-muted-foreground/30" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          Open the Skill Studio from a skill (Skills → select → Open studio).
        </p>
        <Button variant="outline" size="sm" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Skills
        </Button>
      </div>
    )
  }

  // The live version number — derived ONCE at the shell via the shared helper (W1) and
  // threaded down; no consumer re-derives it. Before versions load, versions=[] →
  // deriveLiveVersion returns 1, then updates in place when listSkillVersions resolves.
  const liveVersionNumber = skill ? deriveLiveVersion(skill, versions) : 1
  const caseCount = cases.length

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Persistent header (every tab): ‹ Skills · name · vN · LIVE · condensed gate strip. */}
      <header className="flex shrink-0 flex-col gap-3 border-b border-border/10 px-8 pt-6 pb-3">
        <div>
          <button
            onClick={onBack}
            className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Skills
          </button>
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
            <h1 className="font-headline text-xl font-bold text-foreground">
              {skill?.name ?? "Skill"}
            </h1>
            <span className="font-mono text-sm text-muted-foreground">v{liveVersionNumber}</span>
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold tracking-wide text-emerald-600 dark:text-emerald-400">
              LIVE
            </span>
          </div>
        </div>

        {/* The condensed gate strip — the SAME server PublishGate the EvalsTab stepper
            renders (never a second truth-teller); caseCount from the shell's
            listTestCases length (the SAME list EvalsTab reads). */}
        <LifecycleStepper
          variant="strip"
          publishGate={gate}
          caseCount={caseCount}
          skillVersion={liveVersionNumber}
        />

        {/* Deep-linkable tab bar (Evals · Triggering · Versions). */}
        <nav className="flex items-center gap-1" role="tablist" aria-label="Skill Studio tabs">
          {TABS.map((t) => {
            const active = t.id === tab
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onTabChange(t.id)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-primary/10 font-semibold text-primary"
                    : "text-muted-foreground hover:bg-accent/40 hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            )
          })}
        </nav>
      </header>

      {/* Active tab body — the live version + skillId thread down; the leaves self-fetch
          their own data by skillId. */}
      <div className="flex-1 overflow-y-auto">
        {tab === "evals" ? (
          <div className="px-8 py-6">
            <EvalsTab
              skillId={skillId}
              skillVersion={liveVersionNumber}
              onGateStale={refreshGate}
            />
          </div>
        ) : tab === "triggering" ? (
          <TriggeringTab skillId={skillId} onBack={onBack} />
        ) : (
          <div className="px-8 py-6">
            <VersionsTab skillId={skillId} liveVersionNumber={liveVersionNumber} />
          </div>
        )}
      </div>
    </div>
  )
}

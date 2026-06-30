// ─────────────────────────────────────────────────────────────────────────────
// Phase 133 Plan 05 (EVAL-02) — THIN with-skill-vs-without-skill eval runner surface.
//
// DELIBERATELY NON-DESIGNED / FUNCTIONAL-ONLY (--skip-ui, operator scope fence, D-07).
// This is the EVAL-02 runner made usable end-to-end: pick a provider/model, press
// "Run eval", watch a live per-case with/without progress list, and read a plain
// per-case results readout. It must NOT introduce designed structure (no panel
// chrome, no tabs, no new design-system primitives) that would pre-empt or
// constrain the Phase 137 sketch-gated Skill Evals panel (PANEL-01, G-2). Phase 137
// SUPERSEDES this surface — keep it plain on purpose.
//
// STREAM REUSE (RESEARCH Pattern 3): the eval run wrote a companion public.runs row
// (Plan 04), so the EXISTING chat-run stream client (`subscribeToRun`) carries the
// eval_* progress events with ZERO new stream code — no bespoke EventSource. The
// DURABLE readout always comes from `getEvalRun` (the DB) so it survives the Redis
// buffer TTL + a reload (D-06 / SC#3). Owner-scoping is enforced SERVER-SIDE on
// every route (Plan 04 `.eq("user_id")`); this client only renders what they return.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react"
import { Loader2, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  getProviders,
  startEvalRun,
  getEvalRun,
  listEvalRuns,
  subscribeToRun,
} from "@/lib/api"
import type { EvalResult, EvalRun } from "@/types"

interface Props {
  skillId: string
}

// Live per-arm status keyed by `${testCaseId}:${variant}` — driven off the eval_*
// SSE events while a run streams. "running" on eval_case_started, the terminal
// per-case status on eval_case_done. Falls back to the durable readout once done.
type LiveStatus = Record<string, string>

const VARIANTS = ["with_skill", "without_skill"] as const

export function SkillEvalSection({ skillId }: Props) {
  const [providers, setProviders] = useState<
    { id: string; name: string; models: string[] }[]
  >([])
  const [provider, setProvider] = useState<string>("")
  const [model, setModel] = useState<string>("")

  const [runId, setRunId] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [live, setLive] = useState<LiveStatus>({})
  const [evalRun, setEvalRun] = useState<EvalRun | null>(null)
  const [results, setResults] = useState<EvalResult[]>([])
  const [error, setError] = useState<string | null>(null)

  // Abort the in-flight stream subscription on unmount / re-run so we never leak
  // a reader (subscribeToRun returns silently on AbortError).
  const abortRef = useRef<AbortController | null>(null)

  // Pull the durable readout from the DB (survives the Redis TTL — SC#3).
  async function loadReadout(rid: string) {
    try {
      const { eval_run, eval_results } = await getEvalRun(skillId, rid)
      setEvalRun(eval_run)
      setResults(eval_results)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load eval results.")
    }
  }

  // Attach the EXISTING run-stream client to an eval run_id (live or reattach).
  // No new stream code (Pattern 3) — eval_* events ride the companion runs row.
  function attach(rid: string) {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setRunId(rid)
    setRunning(true)

    void subscribeToRun(
      rid,
      "0",
      {
        onDelta: () => {},
        onDone: () => {},
        onEvalCaseStarted: ({ testCaseId, variant }) =>
          setLive((prev) => ({ ...prev, [`${testCaseId}:${variant}`]: "running" })),
        onEvalCaseDone: ({ testCaseId, variant, status }) =>
          setLive((prev) => ({ ...prev, [`${testCaseId}:${variant}`]: status })),
        onEvalComplete: () => {
          // Durable readout is authoritative; refresh from the DB.
          void loadReadout(rid)
        },
        onTerminal: (kind) => {
          setRunning(false)
          if (kind === "error") setError("Eval run ended with an error.")
          // Always re-fetch the durable readout on any terminal (covers reattach
          // to an already-finished run whose buffer only replayed a terminal).
          void loadReadout(rid)
        },
      },
      ctrl.signal,
    )
  }

  // On mount: load the provider list + reattach to a still-live run (D-06).
  // The thin client has no ephemeral eval thread_id to feed getActiveRuns, so it
  // discovers a live run via the owner-scoped listEvalRuns (the skill-scoped
  // analog) and reattaches via subscribeToRun verbatim — see SUMMARY deviation.
  useEffect(() => {
    let cancelled = false
    // Switching skills: clear the previous skill's readout/live state BEFORE
    // fetching the new skill's runs. Without this, a skill that has no eval runs
    // keeps rendering the previously-viewed skill's results — the stale-state bug
    // where the SAME eval appeared under every skill (the durable readout was
    // never reset when listEvalRuns returned []). The provider/model picker
    // selection is intentionally preserved across skills.
    setRunId(null)
    setRunning(false)
    setLive({})
    setEvalRun(null)
    setResults([])
    setError(null)
    async function init() {
      try {
        const p = await getProviders()
        if (cancelled) return
        setProviders(p.providers)
        setProvider(p.active || p.providers[0]?.id || "")
        setModel(p.active_model || p.providers[0]?.models?.[0] || "")
      } catch {
        /* picker is a convenience; backend validates — ignore load failure */
      }
      try {
        const runs = await listEvalRuns(skillId)
        if (cancelled) return
        const latest = runs[0]
        if (latest) {
          // Always show the latest run's durable readout; reattach if still live.
          await loadReadout(latest.id)
          if (latest.status === "running") attach(latest.id)
        }
      } catch {
        /* no prior runs / load failure — start clean */
      }
    }
    void init()
    return () => {
      cancelled = true
      abortRef.current?.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skillId])

  async function handleRun() {
    if (!provider || !model) {
      setError("Pick a provider and model first.")
      return
    }
    setError(null)
    setLive({})
    setResults([])
    setEvalRun(null)
    setRunning(true)
    try {
      const { run_id } = await startEvalRun(skillId, { provider, model })
      attach(run_id)
    } catch (err) {
      setRunning(false)
      setError(err instanceof Error ? err.message : "Failed to start eval run.")
    }
  }

  const activeProvider = providers.find((p) => p.id === provider)

  // Group durable results by test case for the readout.
  const byCase = new Map<string, Partial<Record<string, EvalResult>>>()
  for (const r of results) {
    const entry = byCase.get(r.test_case_id) ?? {}
    entry[r.variant] = r
    byCase.set(r.test_case_id, entry)
  }
  const caseIds = Array.from(byCase.keys())

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">Eval runner</label>
      </div>

      {/* Provider / model picker (convenience only — backend validates). */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="rounded border border-border/30 bg-background px-2 py-1 text-xs"
          value={provider}
          onChange={(e) => {
            const next = e.target.value
            setProvider(next)
            const np = providers.find((p) => p.id === next)
            setModel(np?.models?.[0] ?? "")
          }}
          disabled={running}
        >
          {providers.length === 0 && <option value="">No providers</option>}
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <select
          className="rounded border border-border/30 bg-background px-2 py-1 text-xs"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          disabled={running}
        >
          {(activeProvider?.models ?? []).length === 0 && <option value="">No models</option>}
          {(activeProvider?.models ?? []).map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        <Button
          type="button"
          size="sm"
          className="text-xs gap-1"
          onClick={handleRun}
          disabled={running || !provider || !model}
        >
          {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
          Run eval
        </Button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Run status line. */}
      {runId && (
        <p className="text-xs text-muted-foreground">
          Run {runId.slice(0, 8)} ·{" "}
          {running ? "streaming…" : evalRun?.status ?? "done"}
        </p>
      )}

      {/* Live per-arm progress (driven by eval_* events while streaming). */}
      {running && Object.keys(live).length > 0 && (
        <ul className="flex flex-col gap-1">
          {Object.entries(live).map(([key, status]) => (
            <li key={key} className="text-xs text-muted-foreground">
              {key.replace(":", " · ")} → {status}
            </li>
          ))}
        </ul>
      )}

      {/* Durable per-case with/without readout (re-fetched from the DB). */}
      {caseIds.length > 0 && (
        <ul className="flex flex-col gap-3">
          {caseIds.map((cid) => {
            const entry = byCase.get(cid) ?? {}
            return (
              <li key={cid} className="flex flex-col gap-2 rounded border border-border/30 p-3">
                <p className="text-xs font-medium text-foreground">Case {cid.slice(0, 8)}</p>
                {VARIANTS.map((v) => {
                  const r = entry[v]
                  return (
                    <div key={v} className="flex flex-col gap-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        {v === "with_skill" ? "With skill" : "Without skill"}
                        {r ? ` · ${r.status}` : " · —"}
                      </p>
                      {r?.output && (
                        <pre className="whitespace-pre-wrap break-words text-xs text-foreground/80">
                          {r.output}
                        </pre>
                      )}
                      {r?.error && <p className="text-xs text-destructive">{r.error}</p>}
                    </div>
                  )
                })}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

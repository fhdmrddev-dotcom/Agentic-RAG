import { useCallback, useEffect, useRef, useState } from "react"
import { RefreshCw, Check, X, CircleDashed, Loader2, Bot } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { providerLogo } from "@/lib/providerLogo"
import { getEngineHealth, runEngineSweep, getEvalRunById } from "@/lib/api"
import type {
  EngineHealthBoard,
  EngineHealthTile,
  EvalResult,
  EvalRunReadout,
} from "@/types"
import { RunCaseDetail } from "@/components/skills/studio/RunCaseDetail"

/**
 * Phase 137.1 Plan 10 (EVAL-05 / sketch 060-A winner: A) — the engine-health tile
 * board. It answers the operator's verbatim trust bar ("how do I know it reflects
 * reality for each model without hand-running all 8"): one compact ✓/✗ tile per
 * CONFIGURED provider (logo + representative model), the whole cross-provider posture
 * in one saccade, plus a "Run sweep" button that POSTs the skill-less smoke sweep.
 *
 * Honesty locks (060-A + the eval-production-clean skill "What to Avoid"):
 *   - D-01/D-02: the subtitle carries the load-bearing semantics ENGINE health ≠
 *     model quality — a model may honestly fail the smoke case and still be a healthy
 *     engine (the sweep is ≈24 LLM calls over a hidden built-in fixture, no user data).
 *   - A ✗ tile (red tint) is rendered ONLY WITH a verbatim provider error demoted
 *     below the grid — never an engine-shaped error, and never a ✗ without the error
 *     (the "engine-shaped errors" trap). An unswept tile is NEUTRAL, never red.
 *   - D-04: on-demand only, staleness ALWAYS shown (amber when old → green "just now"
 *     after a sweep). No scheduler, no config-change nudge — the ONLY setInterval is
 *     the running-poll inside onRunSweep.
 *   - D-03 (checker iteration-2 resolution): each tile deep-links to its smoke run, and
 *     the link RESOLVES — clicking a tile expands an INLINE run-detail section within
 *     this card (one tile at a time), fed by getEvalRunById (the Plan 04 SKILL-LESS
 *     readout; a NULL-skill sweep arm can never mount in the skill-scoped Studio panel)
 *     and rendered with the reused RunCaseDetail leaf. A failed detail fetch renders an
 *     honest inline error, never a dead link.
 *
 * The fetch/poll/re-kick skeleton mirrors ReembedStatusCard: self-fetch on mount,
 * reconcile-on-fetch (keep the last-good board on a failed fetch), light-poll while a
 * sweep is running, re-kick via the button.
 */

const SWEEP_POLL_MS = 3000
// A sweep's arms grade 10-20s AFTER the POST returns (the route spawns the arms and
// returns the board "freshly running"), so the running-poll must keep going until every
// tile is terminal. Bounded so a wedged/never-finishing arm can never poll forever
// (~2 min ceiling at SWEEP_POLL_MS).
const SWEEP_MAX_POLLS = 40
// A board swept within this window reads "just now" (green); older reads amber.
const FRESH_WINDOW_MS = 90_000

// Friendly provider labels for the tiles — falls back to the raw provider key. The
// logo mark itself comes from the single-source providerLogo (@lobehub/icons).
const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  deepseek: "DeepSeek",
  moonshot: "Moonshot",
  zhipu: "GLM (Zhipu)",
  minimax: "MiniMax",
  openrouter: "OpenRouter",
  ollama: "Ollama",
  lmstudio: "LM Studio",
}

// Relative "swept N ago" text + a fresh flag (green when just-swept, amber otherwise).
function staleness(sweptAt: string | null): { text: string; fresh: boolean } {
  if (!sweptAt) return { text: "never swept", fresh: false }
  const ageMs = Date.now() - new Date(sweptAt).getTime()
  if (Number.isNaN(ageMs)) return { text: "never swept", fresh: false }
  if (ageMs < FRESH_WINDOW_MS) return { text: "swept just now", fresh: true }
  const mins = Math.round(ageMs / 60_000)
  if (mins < 60) return { text: `swept ${mins}m ago`, fresh: false }
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return { text: `swept ${hrs}h ago`, fresh: false }
  const days = Math.round(hrs / 24)
  return { text: `swept ${days}d ago`, fresh: false }
}

// A tile's honest state. A ✗ (failed) is ONLY rendered when there is a verbatim error;
// an unhealthy tile with no error yet (e.g. never swept) is NEUTRAL, never red.
type TileState = "healthy" | "failed" | "unswept"
function tileState(tile: EngineHealthTile): TileState {
  if (tile.healthy) return "healthy"
  if (tile.error) return "failed"
  return "unswept"
}

// A sweep arm still RUNNING shows healthy=false with NO error yet (tileState "unswept").
// The sweep is DONE only when every tile is terminal — healthy OR carrying an error — so
// this predicate decides whether the running-poll should keep going. Exported for tests.
export function hasInFlight(b: EngineHealthBoard | null): boolean {
  return !!b?.tiles?.some((t) => !t.healthy && !t.error)
}

export function EngineHealthCard() {
  const [board, setBoard] = useState<EngineHealthBoard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sweeping, setSweeping] = useState(false)

  // The inline deep-link detail (one tile expanded at a time).
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null)
  const [detail, setDetail] = useState<EvalRunReadout | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Guards a slow detail fetch from overwriting a newer expand (last-click wins).
  const detailReqRef = useRef<string | null>(null)

  const refresh = useCallback(async (): Promise<EngineHealthBoard | null> => {
    try {
      const b = await getEngineHealth()
      setBoard(b)
      setError(null)
      return b
    } catch (e) {
      // A failed fetch is transient — keep the last-good board rather than blanking it.
      setError(e instanceof Error ? e.message : "Could not read engine health")
      return null
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Clear the running-poll on unmount (the interval is only ever created in onRunSweep).
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const onRunSweep = useCallback(async () => {
    setSweeping(true)
    setError(null)
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    let posted: EngineHealthBoard | null = null
    try {
      // The route spawns the arms and returns the board "freshly running" — it does NOT
      // wait for grading. So this response is the EARLY snapshot (arms still running).
      posted = await runEngineSweep()
      setBoard(posted)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not run engine sweep")
      setSweeping(false)
      return
    }
    // If every tile is already terminal, we're done. Otherwise KEEP POLLING until the arms
    // grade (10-20s later) — else the board freezes on the 0/N "freshly running" snapshot
    // and misreports healthy engines as neutral (the bug this replaces). The running-poll
    // is the ONLY setInterval and lives only for the duration of an active sweep (D-04: no
    // background scheduler). Bounded by SWEEP_MAX_POLLS so a wedged arm can't poll forever.
    if (!hasInFlight(posted)) {
      setSweeping(false)
      return
    }
    let polls = 0
    pollRef.current = setInterval(async () => {
      polls += 1
      const b = await refresh()
      const settled = b !== null && !hasInFlight(b)
      if (settled || polls >= SWEEP_MAX_POLLS) {
        if (pollRef.current) {
          clearInterval(pollRef.current)
          pollRef.current = null
        }
        setSweeping(false)
      }
    }, SWEEP_POLL_MS)
  }, [refresh])

  // Tile click = the resolvable D-03/060-A deep-link. Toggle an inline detail section
  // fed by the skill-less getEvalRunById readout; only tiles WITH a run_id are links.
  const onTileClick = useCallback(
    async (tile: EngineHealthTile) => {
      if (!tile.run_id) return
      if (expandedProvider === tile.provider) {
        setExpandedProvider(null)
        return
      }
      setExpandedProvider(tile.provider)
      setDetail(null)
      setDetailError(null)
      setDetailLoading(true)
      const rid = tile.run_id
      detailReqRef.current = rid
      try {
        const readout = await getEvalRunById(rid)
        if (detailReqRef.current !== rid) return // a newer tile was clicked — drop this
        setDetail(readout)
      } catch (e) {
        if (detailReqRef.current !== rid) return
        setDetailError(e instanceof Error ? e.message : "Could not load the smoke run detail")
      } finally {
        if (detailReqRef.current === rid) setDetailLoading(false)
      }
    },
    [expandedProvider],
  )

  // First load hasn't landed yet.
  if (!board && !error) {
    return (
      <div
        data-testid="engine-health-card"
        className="rounded-lg border border-border bg-card/60 p-5 shadow-sm"
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading engine health…
        </div>
      </div>
    )
  }

  const tiles = board?.tiles ?? []
  const healthyCount = tiles.filter((t) => t.healthy).length
  const failedTiles = tiles.filter((t) => tileState(t) === "failed")
  const stale = staleness(board?.swept_at ?? null)
  const neverSwept = !board?.swept_at
  const isEmpty = tiles.length === 0

  return (
    <div
      data-testid="engine-health-card"
      className="overflow-hidden rounded-lg border border-border bg-card/60 shadow-sm"
    >
      {/* Header — health count + staleness (ALWAYS shown) + Run sweep */}
      <div className="flex items-start gap-3 p-5 pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-headline text-sm font-bold text-foreground">Eval engine health</h4>
            {!isEmpty && (
              <span className="rounded-full bg-muted/50 px-2 py-0.5 text-[10px] font-mono text-muted-foreground ghost-border">
                {healthyCount}/{tiles.length} engines healthy
              </span>
            )}
            {/* Staleness is ALWAYS rendered — green just-now, amber when old/never (D-04) */}
            <span
              data-testid="engine-staleness"
              data-fresh={stale.fresh ? "true" : "false"}
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-mono",
                stale.fresh ? "bg-success/15 text-success" : "bg-amber-400/15 text-amber-500",
              )}
            >
              {stale.text}
            </span>
          </div>
          {/* What this IS — a GLOBAL cross-provider engine check, NOT a per-skill eval (137.1 UAT:
              the word "engine" alone read as ambiguous). The skill-level surface is the matrix run
              in Skill Studio; this proves the eval engine itself runs, provider by provider. */}
          <p className="mt-1 text-xs text-muted-foreground">
            Checks the <b className="text-foreground/80">skill-eval engine</b> runs end-to-end on
            every configured provider — <b className="text-foreground/80">global, not scoped to any
            single skill</b> (that's the matrix run in a skill's Studio).
          </p>
          {/* Subtitle — the load-bearing semantics, VERBATIM (D-01/D-02) */}
          <p className="mt-1 text-xs text-muted-foreground">
            <b className="text-foreground/80">ENGINE health ≠ model quality</b> — a model may
            honestly fail the smoke case and still be a healthy engine.
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground/70">
            The sweep is ≈24 LLM calls over a hidden built-in smoke case — no user data.
          </p>
        </div>
        <Button
          size="sm"
          onClick={onRunSweep}
          disabled={sweeping}
          className="shrink-0 gap-1.5 gradient-primary border-none font-semibold text-white"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", sweeping && "animate-spin")} />
          {sweeping ? "Sweeping…" : "Run sweep"}
        </Button>
      </div>

      <div className="px-5 pb-5">
        {/* Honest-empty when never swept and/or no configured engines */}
        {isEmpty ? (
          <p className="rounded-md border border-dashed border-border/60 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
            {neverSwept
              ? "No sweep yet — Run sweep to check each configured engine."
              : "No configured engines to sweep."}
          </p>
        ) : (
          <>
            {neverSwept && (
              <p className="mb-3 text-[11px] text-amber-500">
                Never swept — Run sweep to check each engine below.
              </p>
            )}
            {/* Tile grid — one ✓/✗ tile per CONFIGURED provider */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {tiles.map((tile) => {
                const st = tileState(tile)
                const Mark = providerLogo(tile.provider)
                const label = PROVIDER_LABELS[tile.provider] ?? tile.provider
                const isOpen = expandedProvider === tile.provider
                const linkable = !!tile.run_id
                const inner = (
                  <>
                    <div className="flex items-center gap-1.5">
                      {Mark ? (
                        <Mark size={16} />
                      ) : (
                        <Bot aria-hidden className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="truncate text-xs font-semibold text-foreground">{label}</span>
                      <span className="ml-auto shrink-0">
                        {st === "healthy" ? (
                          <Check data-testid={`engine-mark-healthy-${tile.provider}`} className="h-4 w-4 text-success" />
                        ) : st === "failed" ? (
                          <X data-testid={`engine-mark-failed-${tile.provider}`} className="h-4 w-4 text-destructive" />
                        ) : (
                          <CircleDashed data-testid={`engine-mark-unswept-${tile.provider}`} className="h-4 w-4 text-muted-foreground/60" />
                        )}
                      </span>
                    </div>
                    <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground" title={tile.model}>
                      {tile.model}
                    </p>
                  </>
                )
                const tileClass = cn(
                  "rounded-md border p-2.5 text-left transition-colors",
                  st === "failed"
                    ? "border-destructive/30 bg-destructive/5"
                    : st === "healthy"
                      ? "border-success/25 bg-success/5"
                      : "border-border/40 bg-muted/20",
                  linkable && "cursor-pointer hover:border-primary/40",
                  isOpen && "ring-1 ring-primary/40",
                )
                return linkable ? (
                  <button
                    key={tile.provider}
                    type="button"
                    data-testid={`engine-tile-${tile.provider}`}
                    aria-expanded={isOpen}
                    onClick={() => void onTileClick(tile)}
                    className={tileClass}
                  >
                    {inner}
                  </button>
                ) : (
                  <div
                    key={tile.provider}
                    data-testid={`engine-tile-${tile.provider}`}
                    className={tileClass}
                  >
                    {inner}
                  </div>
                )
              })}
            </div>

            {/* Verbatim provider errors — demoted BELOW the grid (never engine-shaped) */}
            {failedTiles.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {failedTiles.map((tile) => (
                  <div
                    key={tile.provider}
                    data-testid={`engine-error-${tile.provider}`}
                    className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2"
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-destructive">
                      {PROVIDER_LABELS[tile.provider] ?? tile.provider}
                    </span>
                    <p className="mt-0.5 whitespace-pre-wrap break-words font-mono text-[11px] text-muted-foreground">
                      {tile.error}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* The resolvable deep-link: an INLINE smoke-run detail for the open tile */}
            {expandedProvider && (
              <EngineTileDetail
                provider={PROVIDER_LABELS[expandedProvider] ?? expandedProvider}
                loading={detailLoading}
                error={detailError}
                readout={detail}
              />
            )}
          </>
        )}

        {error && (
          <p className="mt-2 text-[11px] text-amber-500">{error}</p>
        )}
      </div>
    </div>
  )
}

/**
 * The inline run-detail section for an expanded tile (the D-03 resolvable deep-link
 * destination). It renders the skill-less smoke run's per-arm results by REUSING the
 * pure RunCaseDetail leaf grouped per test case — NOT a navigation into the skill
 * Studio (a NULL-skill sweep run has no Studio home). The built-in smoke fixture's
 * TestCase is not part of the skill-less readout, so RunCaseDetail is fed `null` and
 * shows its neutral prompt fallback; ratings do not apply to a skill-less sweep arm,
 * so `onRate` is inert.
 */
function EngineTileDetail({
  provider,
  loading,
  error,
  readout,
}: {
  provider: string
  loading: boolean
  error: string | null
  readout: EvalRunReadout | null
}) {
  const noRate = useCallback(() => {}, [])

  return (
    <div
      data-testid="engine-tile-detail"
      className="mt-3 rounded-md border border-primary/20 bg-primary/5 p-3"
    >
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading smoke run…
        </div>
      ) : error ? (
        <p data-testid="engine-tile-detail-error" className="text-xs text-destructive">
          {error}
        </p>
      ) : readout ? (
        (() => {
          const run = readout.eval_run
          const byCase = new Map<string, EvalResult[]>()
          for (const r of readout.eval_results) {
            const arr = byCase.get(r.test_case_id) ?? []
            arr.push(r)
            byCase.set(r.test_case_id, arr)
          }
          return (
            <div className="flex flex-col gap-2">
              <p className="font-mono text-[10px] text-muted-foreground/80">
                Smoke run · {provider} · {run.model} · {run.status}
              </p>
              {byCase.size === 0 ? (
                <p className="text-xs text-muted-foreground">No case results in this sweep run.</p>
              ) : (
                Array.from(byCase.entries()).map(([tcId, caseResults]) => (
                  <RunCaseDetail key={tcId} testCase={null} results={caseResults} onRate={noRate} />
                ))
              )}
            </div>
          )
        })()
      ) : null}
    </div>
  )
}

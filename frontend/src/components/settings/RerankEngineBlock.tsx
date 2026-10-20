import { useId } from "react"
import type { KeyboardEvent, ReactNode } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { RERANK_ENGINES, engineFor, type RerankEngineFacts, type RerankKeySource } from "./rerankEngines"

/**
 * RerankEngineBlock — Phase 294-04 (DEC-01 / D-01 / D-02 / D-04 / D-05 / D-20a).
 *
 * The body of the Settings → Search "Reranking" card, built to sketch 294 B (engine cards, the
 * operator's pick and the acceptance bar): under the page's existing Enabled switch, four radio
 * cards in a 2×2 grid, each with its name, where it runs, model id, which saved key it uses, list
 * price and what it can do; then the two numbers; then the red missing-key line; then the amber
 * line saying in words that text leaves the server for a hosted engine. With the switch off the
 * cards are hidden and one line says no engine is called.
 *
 * Every engine fact comes from `rerankEngines.ts` (the 024 rule: preset data is never hardcoded
 * in component logic). Extracted from SettingsPage.tsx in the ModelPillRow style so the card has
 * a narrow test surface (`__tests__/RerankEngineBlock.test.tsx`): values in, callbacks out, no
 * fetch and no local state — the page owns all of it, so its changed-fields save is untouched.
 *
 * Research Open Question 1 (resolved): "Keep at most N passages per search" is bound to
 * `retrieval_top_k`, the real cap on passages sent to the main model (the same state as the
 * Retrieval card's Top-K, so the two cannot drift). `rerank_top_n` is the candidate POOL, so its
 * control says "Score the best M candidates first" — two controls, two real settings.
 *
 * ⛔ Rendering never calls a setter: a stored legacy `"api"` id selects the Cohere card and stays
 * `"api"` until the operator clicks a card, so hydrate produces no spurious save diff.
 * ⛔ Key status is a glyph plus a word, never colour alone (the ConfidenceChip rule).
 */
export interface RerankEngineBlockProps {
  /** `rerank_enabled` — the single on/off (D-01); the switch itself stays on the page. */
  enabled: boolean
  /** Stored `rerank_provider` (may be the legacy `"api"`, which means Cohere). */
  provider: string
  onProviderChange: (id: string) => void
  /** Stored `rerank_model`; empty or another engine's model resolves to the engine's default. */
  model: string
  onModelChange: (m: string) => void
  /** `rerank_top_n` — how many fused candidates the engine scores. */
  poolSize: number
  onPoolSizeChange: (n: number) => void
  /** `retrieval_top_k` — how many passages reach the main model (OQ1). */
  keepAtMost: number
  onKeepAtMostChange: (n: number) => void
  /** `hybrid_search_enabled` — the vector-only path never reranks. */
  hybridEnabled: boolean
  /** Which saved keys exist (booleans only; the key values never reach the browser). */
  hasKey: Record<RerankKeySource, boolean>
  /** The page's own key input, rendered only while Cohere is selected (its key is its own). */
  cohereKeySlot?: ReactNode
  /** The Search tab's "saved" flash. */
  saved?: boolean
}

// Panel AA tokens (index.css), the same ones ConfidenceChip uses.
const GREEN = "text-[hsl(var(--panel-status-done))]"
const AMBER = "text-[hsl(var(--panel-status-active))]"
const RED = "text-[hsl(0_80%_80%)]"

function hasKeyFor(facts: RerankEngineFacts, hasKey: RerankEngineBlockProps["hasKey"]): boolean {
  return facts.keySource === null || hasKey[facts.keySource] === true
}

function KeyStatus({ facts, ok }: { facts: RerankEngineFacts; ok: boolean }) {
  if (facts.keyName === null) return <span className={GREEN}>no key needed</span>
  if (ok) {
    return (
      <span className={GREEN}>
        <span aria-hidden="true">✓ </span>uses your saved {facts.keyName}
      </span>
    )
  }
  return (
    <span className={RED}>
      <span aria-hidden="true">✕ </span>
      {facts.keyName} missing
    </span>
  )
}

function WhereTag({ facts }: { facts: RerankEngineFacts }) {
  const local = facts.where === "local"
  return (
    <span
      className={cn(
        "ml-auto shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 font-mono text-[10px] font-normal",
        local
          ? "border-[hsl(var(--panel-status-done)/0.4)] bg-[hsl(var(--panel-status-done)/0.1)] text-[hsl(var(--panel-status-done))]"
          : "border-[hsl(var(--panel-status-active)/0.4)] bg-[hsl(var(--panel-status-active)/0.1)] text-[hsl(var(--panel-status-active))]",
      )}
    >
      {local ? "● stays on your server" : `↗ hosted · ${facts.vendor}`}
    </span>
  )
}

/** The input's bounds (its own `min` / `max`). */
const KEEP_MIN = 1
const KEEP_MAX = 50

/**
 * 294-REVIEW WR-04: a cleared field is `Number("") === 0`, which was saved and made the prune keep
 * nothing. An empty or non-numeric entry reports nothing (the field keeps the previous value);
 * anything else is clamped to the input's own 1-50 range.
 */
function keepAtMostFrom(raw: string): number | null {
  if (raw.trim() === "") return null
  const n = Number(raw)
  if (!Number.isFinite(n)) return null
  return Math.min(KEEP_MAX, Math.max(KEEP_MIN, Math.trunc(n)))
}

function capabilities(facts: RerankEngineFacts): string {
  return `${facts.cuts ? "cuts below 0.1" : "reorders only"} · steering ${facts.steering ? "✓" : "—"} · citation check ${facts.citationCheck ? "✓" : "—"}`
}

export function RerankEngineBlock({
  enabled,
  provider,
  onProviderChange,
  model,
  onModelChange,
  poolSize,
  onPoolSizeChange,
  keepAtMost,
  onKeepAtMostChange,
  hybridEnabled,
  hasKey,
  cohereKeySlot,
  saved = false,
}: RerankEngineBlockProps) {
  const idBase = useId()

  if (!enabled) {
    return (
      <p className="pb-1 text-xs text-muted-foreground">
        Search returns its candidates in today's order. No engine is called.
      </p>
    )
  }

  const selected = engineFor(provider)
  const selectedHasKey = hasKeyFor(selected, hasKey)

  function choose(facts: RerankEngineFacts) {
    onProviderChange(facts.id)
    onModelChange(facts.defaultModel)
  }

  function onCardKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0
    if (step === 0) return
    e.preventDefault()
    const next = (index + step + RERANK_ENGINES.length) % RERANK_ENGINES.length
    choose(RERANK_ENGINES[next])
    e.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus()
  }

  return (
    <div className="space-y-3 pb-1">
      <div role="radiogroup" aria-label="Reranking engine" className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {RERANK_ENGINES.map((facts, index) => {
          const isSel = facts.id === selected.id
          const titleId = `${idBase}-${facts.id}-title`
          return (
            <button
              key={facts.id}
              type="button"
              role="radio"
              aria-checked={isSel}
              aria-labelledby={titleId}
              tabIndex={isSel ? 0 : -1}
              data-engine={facts.id}
              onClick={() => choose(facts)}
              onKeyDown={(e) => onCardKeyDown(e, index)}
              className={cn(
                "rounded-lg border px-3 py-2.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                isSel ? "border-primary bg-primary/10 ring-1 ring-inset ring-primary" : "ghost-border bg-background/40 hover:border-primary/60",
              )}
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-3 w-3 shrink-0 rounded-full border-2",
                    isSel ? "border-primary bg-primary" : "border-muted-foreground/60",
                  )}
                />
                <span id={titleId}>{facts.name}</span>
                <WhereTag facts={facts} />
              </span>
              <span className="mb-1.5 ml-5 mt-0.5 block font-mono text-[10px] text-muted-foreground">
                {isSel && model.trim() ? model : facts.defaultModel}
              </span>
              <span className="ml-5 block text-xs leading-relaxed text-muted-foreground">
                <span className="block">
                  <KeyStatus facts={facts} ok={hasKeyFor(facts, hasKey)} />
                </span>
                <span className="block">{facts.price}</span>
                <span className="block">{capabilities(facts)}</span>
                {facts.firstUseNote && <span className="mt-1 block italic">{facts.firstUseNote}</span>}
              </span>
            </button>
          )
        })}
      </div>

      <div className="space-y-2 text-sm text-muted-foreground">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span>Keep at most</span>
            <Input
              type="number"
              value={keepAtMost}
              onChange={(e) => {
                const n = keepAtMostFrom(e.target.value)
                if (n !== null) onKeepAtMostChange(n)
              }}
              min={KEEP_MIN}
              max={KEEP_MAX}
              aria-label="Keep at most (passages per search)"
              className="h-8 w-20 bg-muted/30 font-mono text-sm ghost-border"
            />
            <span>passages per search</span>
          </div>
          <p className="mt-1 text-xs">The same number as Top-K chunks under Retrieval.</p>
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span>Score the best</span>
            <Input
              type="number"
              value={poolSize}
              onChange={(e) => onPoolSizeChange(Number(e.target.value))}
              min={1}
              max={50}
              aria-label="Score the best (candidates first)"
              className="h-8 w-20 bg-muted/30 font-mono text-sm ghost-border"
            />
            <span>candidates first</span>
          </div>
          <p className="mt-1 text-xs">A larger pool gives the engine room to cut; measured at 20.</p>
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span>Model</span>
            <Input
              type="text"
              value={model}
              onChange={(e) => onModelChange(e.target.value)}
              placeholder={selected.defaultModel}
              aria-label="Model"
              className="h-8 max-w-xs flex-1 bg-muted/30 font-mono text-sm ghost-border"
            />
          </div>
          <p className="mt-1 text-xs">Empty, or a model this engine does not offer, uses the default shown on its card.</p>
        </div>
        {selected.id === "cohere" && cohereKeySlot && (
          <div className="flex flex-wrap items-center gap-2">
            <span>Cohere rerank key</span>
            <div className="max-w-xs flex-1">{cohereKeySlot}</div>
          </div>
        )}
      </div>

      {!hybridEnabled && (
        <p className={cn("text-xs", AMBER)}>
          Reranking runs on hybrid search only. Hybrid search is off under Retrieval, so no engine is called until you turn it on.
        </p>
      )}

      {!selectedHasKey && selected.keyName !== null && (
        <p role="status" className={cn("rounded-lg border border-destructive/40 bg-destructive/15 px-3 py-2 text-sm", RED)}>
          This engine can't run without your {selected.keyName}. Until you add it, search keeps today's order.
        </p>
      )}

      {selected.where === "hosted" && (
        <p
          data-egress
          className="rounded-lg border border-[hsl(var(--panel-status-active)/0.35)] border-l-[3px] border-l-[hsl(var(--panel-status-active))] bg-[hsl(var(--panel-status-active)/0.06)] px-3 py-2 text-sm text-muted-foreground"
        >
          <b className="text-foreground">Text leaves your server.</b> The passages each search finds
          {selected.citationCheck ? " and, when someone checks citations, the cited answer sentences" : ""} are sent to{" "}
          {selected.vendor} to be scored. Nothing is sent while reranking is off or set to “On this server”.
        </p>
      )}

      <p className="text-xs text-muted-foreground">Applies to every knowledge-base search, including workflow steps.</p>
      <p className={cn("text-xs", saved ? GREEN : "text-muted-foreground")}>
        {saved ? (
          <>
            <span aria-hidden="true">✓ </span>Saved for the whole organisation
          </>
        ) : (
          "Applies to the whole organisation when you save."
        )}
      </p>
    </div>
  )
}

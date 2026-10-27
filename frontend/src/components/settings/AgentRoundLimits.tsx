import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getSettings, type FullAppSettings, type SettingsUpdate } from "@/lib/api"

/**
 * AgentRoundLimits — Phase 292.1 (BUG-261024-03, D-17 / D-18).
 *
 * The two tool-round caps in Settings → AI model: how many tool rounds a chat turn (default 15) and
 * an explorer turn (default 8) may run before the turn stops with the limit line and a Continue
 * button. Both are app-wide `app_settings` columns (migration 214), bounded 2..50 in three places
 * that agree: the migration CHECK, the `PUT /settings` 400, and the clamp below.
 *
 * WHY A LEAF. `SettingsPage.tsx` is G-5 FIRING with its state split owed, so (the 294-04
 * RerankEngineBlock precedent) this component owns its own fetch and draft state, and the page holds
 * only a ref to it — no state, no hydrate entry.
 *
 * ONE SAVE PER SECTION (292.1 UAT, operator 2026-10-24: "I set the limit of the rounds to 2 and hit
 * save, but it is not saving"). This leaf used to carry its own "Save tool rounds" button beside the
 * section's "Save AI Model"; the operator pressed "Save AI Model", whose body never carried the caps,
 * so `updated_at` moved, the cap stayed 15, and nothing said so. Two buttons made the wrong save
 * possible. Now there is no button here: the page's save merges `changes()` into its ONE PUT and
 * hands the response back through `adopt()`. Its "Saved!" and its error banner are the feedback.
 *
 * ⛔ Invariants:
 *  - It owns its fetch and drafts; the page reaches it only through the handle below.
 *  - CHANGED FIELDS ONLY: `changes()` carries a cap only when its value differs from the loaded one.
 *  - A cleared or non-numeric field is never sent — `Number("") === 0` must never reach the server
 *    (the 294-REVIEW WR-04 defect). It is simply left out.
 *  - Until the read has answered, `changes()` is `{}` — the section still saves its model fields.
 *  - After a save the fields show the SERVER's values, never the typed ones.
 *  - The bounds below mirror the server's; the server stays the boundary.
 *  - (292.1-REVIEW WR-05) Nothing is shown as live, or saved, before the read answers: the fields
 *    are empty and locked while loading, and a failed read says so (with Retry) — never 15 / 8.
 */

const ROUNDS_MIN = 2
const ROUNDS_MAX = 50
const CHAT_DEFAULT = 15
const EXPLORER_DEFAULT = 8

/** Empty or non-numeric reports nothing; anything else is clamped to 2..50. */
function roundsFrom(raw: string): number | null {
  if (raw.trim() === "") return null
  const n = Number(raw)
  if (!Number.isFinite(n)) return null
  return Math.min(ROUNDS_MAX, Math.max(ROUNDS_MIN, Math.trunc(n)))
}

type Caps = { chat: number; explorer: number }

/** What the section's save reads before its PUT, and hands the PUT's response back to. */
export type AgentRoundLimitsHandle = {
  /** The changed caps, ready to spread into the section's body; `{}` until the read has answered. */
  changes: () => SettingsUpdate
  /** Show the values the server now holds. */
  adopt: (saved: Pick<FullAppSettings, "chat_max_tool_rounds" | "explorer_max_tool_rounds">) => void
}

function RoundRow({
  id,
  label,
  hint,
  value,
  disabled,
  onChange,
  onBlur,
}: {
  id: string
  label: string
  hint: string
  value: string
  disabled: boolean
  onChange: (raw: string) => void
  onBlur: () => void
}) {
  return (
    <div className="py-2.5">
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor={id} className="w-44 shrink-0 text-sm text-muted-foreground">
          {label}
        </Label>
        <div className="max-w-xs flex-1">
          <Input
            id={id}
            type="number"
            inputMode="numeric"
            value={value}
            min={ROUNDS_MIN}
            max={ROUNDS_MAX}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            className="h-8 w-20 bg-muted/30 font-mono text-sm ghost-border"
          />
        </div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

export function AgentRoundLimits({ ref }: { ref?: Ref<AgentRoundLimitsHandle> }) {
  const [loaded, setLoaded] = useState<Caps>({ chat: CHAT_DEFAULT, explorer: EXPLORER_DEFAULT })
  // 292.1-REVIEW WR-05: the fields are empty and locked until the server has answered. A failed read
  // used to leave 15 / 8 on screen AS IF loaded — with the server holding 3 the operator saw 15,
  // typing 15 was "not dirty", and the cap silently stayed at 3. Nothing is saved against a value
  // this leaf never read.
  const [loadState, setLoadState] = useState<"loading" | "loaded" | "failed">("loading")
  const [loadError, setLoadError] = useState<string | null>(null)
  const [chatDraft, setChatDraft] = useState("")
  const [explorerDraft, setExplorerDraft] = useState("")
  const alive = useRef(true)

  function load() {
    setLoadState("loading")
    setLoadError(null)
    getSettings()
      .then((s) => {
        if (!alive.current) return
        const caps = {
          // An older backend that omits the fields runs on the same 15 / 8 fallback.
          chat: s.chat_max_tool_rounds ?? CHAT_DEFAULT,
          explorer: s.explorer_max_tool_rounds ?? EXPLORER_DEFAULT,
        }
        setLoaded(caps)
        setChatDraft(String(caps.chat))
        setExplorerDraft(String(caps.explorer))
        setLoadState("loaded")
      })
      .catch((e: unknown) => {
        if (!alive.current) return
        setLoadError(e instanceof Error ? e.message : null)
        setLoadState("failed")
      })
  }

  useEffect(() => {
    alive.current = true
    load()
    return () => {
      alive.current = false
    }
  }, [])

  function changes(): SettingsUpdate {
    const body: SettingsUpdate = {}
    // WR-05: nothing is saved against a value this leaf never read.
    if (loadState !== "loaded") return body
    const chat = roundsFrom(chatDraft)
    const explorer = roundsFrom(explorerDraft)
    if (chat !== null && chat !== loaded.chat) body.chat_max_tool_rounds = chat
    if (explorer !== null && explorer !== loaded.explorer) body.explorer_max_tool_rounds = explorer
    return body
  }

  // No deps on purpose: the handle is rebuilt every render, so the page's save always reads the
  // drafts as last committed.
  useImperativeHandle(ref, () => ({
    changes,
    adopt(saved) {
      if (loadState !== "loaded") return
      const caps = {
        chat: saved.chat_max_tool_rounds ?? loaded.chat,
        explorer: saved.explorer_max_tool_rounds ?? loaded.explorer,
      }
      setLoaded(caps)
      setChatDraft(String(caps.chat))
      setExplorerDraft(String(caps.explorer))
    },
  }))

  /** On blur, show the value that would be sent (clamped) — or the loaded one for a cleared field. */
  function settle(draft: string, fallback: number, set: (v: string) => void) {
    return () => {
      const n = roundsFrom(draft)
      set(String(n ?? fallback))
    }
  }

  const ready = loadState === "loaded"

  return (
    <div data-agent-round-limits>
      <RoundRow
        id="agent-round-limit-chat"
        label="Tool rounds per chat turn"
        hint="When a turn reaches this many tool rounds it stops with a Continue button. Default 15."
        value={chatDraft}
        disabled={!ready}
        onChange={setChatDraft}
        onBlur={settle(chatDraft, loaded.chat, setChatDraft)}
      />
      <RoundRow
        id="agent-round-limit-explorer"
        label="Tool rounds per explorer turn"
        hint="Default 8."
        value={explorerDraft}
        disabled={!ready}
        onChange={setExplorerDraft}
        onBlur={settle(explorerDraft, loaded.explorer, setExplorerDraft)}
      />
      {loadState === "failed" && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/15 px-3 py-2 text-sm text-[hsl(0_80%_80%)]">
          <span>
            Couldn't load the current tool-round limits, so they can't be changed here right now.
            {loadError ? ` ${loadError}` : ""}
          </span>
          <Button type="button" size="sm" variant="outline" onClick={load}>
            Retry
          </Button>
        </div>
      )}
      <p className="py-1 text-xs text-muted-foreground">
        Applies to every chat once you click Save AI Model.
      </p>
    </div>
  )
}

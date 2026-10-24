import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { getSettings, updateSettings, type SettingsUpdate } from "@/lib/api"

/**
 * AgentRoundLimits — Phase 292.1 (BUG-261024-03, D-17 / D-18).
 *
 * The two tool-round caps in Settings → AI model: how many tool rounds a chat turn (default 15) and
 * an explorer turn (default 8) may run before the turn stops with the limit line and a Continue
 * button. Both are app-wide `app_settings` columns (migration 214), bounded 2..50 in three places
 * that agree: the migration CHECK, the `PUT /settings` 400, and the clamp below.
 *
 * WHY A LEAF. `SettingsPage.tsx` is G-5 FIRING with its state split owed, so (the 294-04
 * RerankEngineBlock precedent, taken one step further) this component owns its own fetch and save
 * and the page gains exactly one import and one mount line — no state, no hydrate, no payload entry.
 *
 * ⛔ Invariants:
 *  - It owns its fetch and save; nothing here reaches into the page's state or its Save button.
 *  - CHANGED FIELDS ONLY: the PUT carries a cap only when its value differs from the loaded one.
 *  - A cleared or non-numeric field is never sent — `Number("") === 0` must never reach the server
 *    (the 294-REVIEW WR-04 defect). It is simply left out.
 *  - A refusal renders the server's sentence VERBATIM; "✓ Saved" appears only after a resolved PUT.
 *  - The bounds below mirror the server's; the server stays the boundary.
 */

const ROUNDS_MIN = 2
const ROUNDS_MAX = 50
const CHAT_DEFAULT = 15
const EXPLORER_DEFAULT = 8

// Panel AA token (index.css), the one RerankEngineBlock's saved flash uses.
const GREEN = "text-[hsl(var(--panel-status-done))]"

/** Empty or non-numeric reports nothing; anything else is clamped to 2..50. */
function roundsFrom(raw: string): number | null {
  if (raw.trim() === "") return null
  const n = Number(raw)
  if (!Number.isFinite(n)) return null
  return Math.min(ROUNDS_MAX, Math.max(ROUNDS_MIN, Math.trunc(n)))
}

type Caps = { chat: number; explorer: number }

function RoundRow({
  id,
  label,
  hint,
  value,
  onChange,
  onBlur,
}: {
  id: string
  label: string
  hint: string
  value: string
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

export function AgentRoundLimits() {
  const [loaded, setLoaded] = useState<Caps>({ chat: CHAT_DEFAULT, explorer: EXPLORER_DEFAULT })
  const [chatDraft, setChatDraft] = useState(String(CHAT_DEFAULT))
  const [explorerDraft, setExplorerDraft] = useState(String(EXPLORER_DEFAULT))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const alive = useRef(true)
  // An edit made before the fetch resolves must not be overwritten by it.
  const touched = useRef(false)

  useEffect(() => {
    alive.current = true
    getSettings()
      .then((s) => {
        if (!alive.current) return
        const caps = {
          chat: s.chat_max_tool_rounds ?? CHAT_DEFAULT,
          explorer: s.explorer_max_tool_rounds ?? EXPLORER_DEFAULT,
        }
        setLoaded(caps)
        if (!touched.current) {
          setChatDraft(String(caps.chat))
          setExplorerDraft(String(caps.explorer))
        }
      })
      .catch(() => {
        // The defaults stay on screen; the server's own fallback is the same 15 / 8.
      })
    return () => {
      alive.current = false
    }
  }, [])

  function changes(): SettingsUpdate {
    const body: SettingsUpdate = {}
    const chat = roundsFrom(chatDraft)
    const explorer = roundsFrom(explorerDraft)
    if (chat !== null && chat !== loaded.chat) body.chat_max_tool_rounds = chat
    if (explorer !== null && explorer !== loaded.explorer) body.explorer_max_tool_rounds = explorer
    return body
  }

  function edit(set: (v: string) => void) {
    return (raw: string) => {
      touched.current = true
      setSaved(false)
      setError(null)
      set(raw)
    }
  }

  /** On blur, show the value that would be sent (clamped) — or the loaded one for a cleared field. */
  function settle(draft: string, fallback: number, set: (v: string) => void) {
    return () => {
      const n = roundsFrom(draft)
      set(String(n ?? fallback))
    }
  }

  async function save() {
    const body = changes()
    if (Object.keys(body).length === 0) return
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const s = await updateSettings(body)
      if (!alive.current) return
      const caps = {
        chat: s.chat_max_tool_rounds ?? body.chat_max_tool_rounds ?? loaded.chat,
        explorer: s.explorer_max_tool_rounds ?? body.explorer_max_tool_rounds ?? loaded.explorer,
      }
      setLoaded(caps)
      setChatDraft(String(caps.chat))
      setExplorerDraft(String(caps.explorer))
      setSaved(true)
    } catch (e) {
      if (!alive.current) return
      setError(e instanceof Error ? e.message : "Failed to save settings")
    } finally {
      if (alive.current) setSaving(false)
    }
  }

  const dirty = Object.keys(changes()).length > 0

  return (
    <div data-agent-round-limits>
      <RoundRow
        id="agent-round-limit-chat"
        label="Tool rounds per chat turn"
        hint="When a turn reaches this many tool rounds it stops with a Continue button. Default 15."
        value={chatDraft}
        onChange={edit(setChatDraft)}
        onBlur={settle(chatDraft, loaded.chat, setChatDraft)}
      />
      <RoundRow
        id="agent-round-limit-explorer"
        label="Tool rounds per explorer turn"
        hint="Default 8."
        value={explorerDraft}
        onChange={edit(setExplorerDraft)}
        onBlur={settle(explorerDraft, loaded.explorer, setExplorerDraft)}
      />
      <div className="flex flex-wrap items-center gap-3 py-2">
        <Button type="button" size="sm" variant="outline" disabled={!dirty || saving} onClick={() => void save()}>
          {saving ? "Saving…" : "Save tool rounds"}
        </Button>
        {saved && (
          <span role="status" className={cn("text-xs", GREEN)}>
            ✓ Saved
          </span>
        )}
        {!saved && !error && (
          <span className="text-xs text-muted-foreground">Applies to every chat when you save.</span>
        )}
      </div>
      {error && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/15 px-3 py-2 text-sm text-[hsl(0_80%_80%)]">
          {error}
        </p>
      )}
    </div>
  )
}

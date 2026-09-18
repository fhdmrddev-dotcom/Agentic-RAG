import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ArrowUp, ChevronDown, Compass, Cpu, HardDrive, Layers, Paperclip, Plus } from "lucide-react"
// Phase 194.1 Plan 04 (RUN-01 / R1) — the composer's Stop is now the ONE shared
// `StopControl` every mount renders. The lucide `Square` moved WITH it (it is
// still the Stop control's mark on every variant, D-18); it is dropped from this
// import because this file no longer draws the control itself.
import { StopControl } from "./StopControl"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MODEL_INFO } from "@/lib/model-info"
import { providerLogo, modelLogo } from "@/lib/providerLogo"
import { NO_TOOLS_LABEL, UNVERIFIED, unverifiedDescription } from "@/lib/unverifiedModelCopy"
import { cn } from "@/lib/utils"
// Phase 154 (LANG-01 / D-03) — General/Explorer keep their already-plain labels
// (routed through the single-source term-map so nothing drifts) and gain a one-line
// helper. Additive DISPLAY strings only — no render-flow / stream logic; the
// "default"/"explorer" enum + MessageItem.tsx / StreamsProvider.tsx stay untouched (G-5).
import { TERM_MAP, usePlainLabel } from "@/lib/termMap"
import { ConnectorsFlyout } from "./ConnectorsFlyout"
import { ActiveConnectorChips } from "./ActiveConnectorChips"
import { ConnectedFilePickerModal } from "./ConnectedFilePickerModal"
import { listConnectorConnections, type ConnectorConnection } from "@/lib/api"
import type { Message } from "@/types"
// ── Phase 244 (244-05 T2 / SHELL-04) — the composer's LOCAL attach door ──────────────────
// Sketch 236's winner is A — Scope on the chip (operator, 2026-09-11): the `+` menu stays PLAIN
// and the CHIP carries `this chat only · 24h`. Every word below comes from the port; ⛔ nothing
// here is re-typed out of the sketch's HTML (the feedback-sketch-to-build-drift rule).
import { COPY } from "./composerCopy"
import { ChatAttachmentChip } from "./ChatAttachmentChip"
// ⛔ G-5: the attach state + its three verbs live in their OWN seam now (244-06). `244-05` named
// this extraction as the debt it was deliberately not paying in the same commit as a feature.
import { useComposerAttachments } from "./useComposerAttachments"
// ⛔ The `accept=` list is READ, never re-listed. 244-02 collapsed three hand-typed copies into
// this one constant and fenced it `?raw` against `backend/app/api/workspace.py`; a fourth copy
// here would be invisible to that fence (T-244-05-02).
import { WORKSPACE_ACCEPT_ATTR } from "@/lib/workspaceAllowedExt"
// ⛔ `useStreamActions` moved WITH the state it served — `useComposerAttachments` owns the
// optimistic `setWorkspaceFileForThread` reconcile for BOTH doors now (244-06 / G-5).

interface Provider {
  id: string
  name: string
  models: string[]
  is_active: boolean
}

interface Props {
  onSend: (content: string, activeConnectorIds?: string[]) => void
  disabled: boolean
  threadId?: string | null
  messages?: Message[]
  providers?: Provider[]
  selectedProvider?: string
  onProviderChange?: (providerId: string) => void
  models?: string[]
  selectedModel?: string
  onModelChange?: (model: string) => void
  deprecatedModels?: Set<string>
  /** Phase 249 (MODEL-05): the ids the platform considers REGISTERED — built-ins PLUS
   *  operator-entered override rows. A model absent from this set runs on inferred defaults.
   *  ⚠ Optional + EMPTY-MEANS-UNKNOWN: an empty set marks nothing, so an older backend (or a
   *  caller that has not wired it) renders exactly as before rather than flagging every model. */
  verifiedModels?: Set<string>
  /** Phase 249: per-unverified-model inferred provider, computed server-side. */
  inferredProviderFor?: Record<string, string>
  /** ⭐ Phase 249: unverified ids whose inferred provider has NO native tool calling — these
   *  run with every tool unavailable and say so nowhere else. */
  toolsLostModels?: Set<string>
  agentMode?: "default" | "explorer"
  onAgentModeChange?: (mode: "default" | "explorer") => void
  prefillMessage?: string | null
  onClearPrefill?: () => void
  /** Take the person to the connections surface — see `ConnectorsFlyout`. */
  onOpenConnections?: () => void
  workflowLocked?: boolean
}

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  openrouter: "OpenRouter",
  ollama: "Ollama",
}

// Per-thread unsent composer drafts (session-scoped, Slack-style). Keyed by
// thread id; the pre-creation "new chat" composer uses NEW_CHAT_DRAFT_KEY.
// Module-level on purpose: survives MessageInput re-renders and thread
// navigation without persisting anything.
const NEW_CHAT_DRAFT_KEY = "__new__"
const composerDraftsByThread = new Map<string, string>()

/**
 * ⭐ THE CONNECTOR SELECTION, REMEMBERED PER THREAD — the same shape as the draft map
 * directly above, and for a related reason.
 *
 * ⚠ IT IS PART OF THE FIX, NOT A FEATURE RIDING ALONG WITH IT. Until 2026-08-31 an empty
 * selection was sent as `undefined` and the backend read that as EVERY enabled
 * connection, so a composer that had never been touched silently had every connector
 * live. Closing that hole without this map would swap one wrong behaviour for an
 * irritating one: every new message would start with nothing selected, and a person who
 * had already said "yes, use Google here" would have to say it again on the next turn.
 * Off now means off — and on stays on for the conversation you said it in.
 */
const activeConnectorsByThread = new Map<string, string[]>()

/** Test-only: reset the module-scoped draft map between test cases. */
export function _resetComposerDraftsForTest() {
  composerDraftsByThread.clear()
  activeConnectorsByThread.clear()
}

/** Stable empty default — an omitted `toolsLostModels` must not allocate a new Set per render. */
const EMPTY_MODEL_SET: ReadonlySet<string> = new Set<string>()

export function MessageInput({
  onSend,
  disabled,
  threadId,
  messages,
  providers = [],
  selectedProvider,
  onProviderChange,
  models = [],
  selectedModel,
  onModelChange,
  deprecatedModels,
  verifiedModels,
  inferredProviderFor,
  toolsLostModels,
  agentMode = "default",
  onAgentModeChange,
  prefillMessage,
  onClearPrefill,
  onOpenConnections,
  workflowLocked = false,
}: Props) {
  const [value, setValue] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Phase 216 (CHAT-05 / CHAT-06): active connectors per thread
  const [connections, setConnections] = useState<ConnectorConnection[]>([])
  const [filePickerOpen, setFilePickerOpen] = useState(false)
  const [plusMenuOpen, setPlusMenuOpen] = useState(false)

  // ── Phase 244 (244-06 T3 / SHELL-04 / G-5) — BOTH ATTACH DOORS LIVE IN ONE SEAM ────────
  // ⛔ The state and the three verbs were EXTRACTED to `useComposerAttachments` because
  // `244-05` grew this file `643 → 855`, refused to call that "honoured by construction", and
  // NAMED this seam as the debt. ⭐ The cloud door therefore lands in the hook and this file
  // SHRINKS rather than growing a third time on a G-5-firing surface.
  const {
    pending: pendingAttachments,
    refusal,
    attachLocalFile,
    attachCloudFile,
    removeAttachment: handleRemoveAttachment,
    dismissRefusal,
    clear: clearAttachments,
  } = useComposerAttachments(threadId)
  const attachInputRef = useRef<HTMLInputElement>(null)

  // Phase 223 (BUG-260902-03 / D-223-06 / D-223-07):
  // Decision 2: key the restore on Map.has(), never on the value.
  // activeConnectorsByThread.get(id) returns undefined for ABSENT and [] for EXPLICITLY CLEARED.
  // A falsy or .length check treats them alike, so a reload re-arms connectors the person turned off.
  // Rider 1: Seed from the last USER message (role === 'user' && activeConnectorIds !== undefined).
  // Assistant messages carry no armed set.
  const draftKey = threadId ?? NEW_CHAT_DRAFT_KEY
  const prevDraftKeyRef = useRef(draftKey)
  const activeConnectorIdsRef = useRef<string[]>([])

  const [activeConnectorIds, setActiveConnectorIds] = useState<string[]>(() => {
    if (activeConnectorsByThread.has(draftKey)) {
      return activeConnectorsByThread.get(draftKey)!
    }
    if (messages && messages.length > 0) {
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i]
        if (msg.role === "user" && msg.activeConnectorIds !== undefined) {
          activeConnectorsByThread.set(draftKey, msg.activeConnectorIds)
          return msg.activeConnectorIds
        }
      }
    }
    return []
  })

  activeConnectorIdsRef.current = activeConnectorIds

  // Hydrate from messages when unvisited in this session (e.g. async fetch of messages)
  useEffect(() => {
    if (activeConnectorsByThread.has(draftKey)) {
      return
    }
    if (!messages || messages.length === 0) return

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      if (msg.role === "user" && msg.activeConnectorIds !== undefined) {
        activeConnectorsByThread.set(draftKey, msg.activeConnectorIds)
        setActiveConnectorIds(msg.activeConnectorIds)
        activeConnectorIdsRef.current = msg.activeConnectorIds
        return
      }
    }
  }, [draftKey, messages])

  useEffect(() => {
    let cancelled = false
    listConnectorConnections()
      .then((conns) => {
        if (!cancelled) setConnections(conns.filter((c) => c.is_enabled !== false))
      })
      .catch((err) => console.error("Failed to load connections", err))
    return () => {
      cancelled = true
    }
  }, [])

  const handleToggleConnector = useCallback((id: string) => {
    setActiveConnectorIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
      activeConnectorIdsRef.current = next
      activeConnectorsByThread.set(draftKey, next)
      return next
    })
  }, [draftKey])

  const handleRemoveConnector = useCallback((id: string) => {
    setActiveConnectorIds((prev) => {
      const next = prev.filter((item) => item !== id)
      activeConnectorIdsRef.current = next
      activeConnectorsByThread.set(draftKey, next)
      return next
    })
  }, [draftKey])

  const onAttachInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    // Reset the input so re-selecting the same file fires change again (TemplateUpload.tsx).
    e.target.value = ""
    if (f) void attachLocalFile(f)
  }

  /**
   * ── Phase 244 (244-06 T3 / D-244-05) — THE CLOUD DOOR'S COMMIT ────────────────────────
   * The modal raises the pick; THIS decides what it means, and it means *this conversation*.
   * ⛔ It does not touch `value`: the arm D-244-02 rejects is appending `Attached file: <name>`
   * into the person's draft, which this mount carried until this commit.
   */
  const handleAttachCloudFile = useCallback(
    ({ connectionId, file }: { connectionId: string; file: { id: string; name: string } }) =>
      attachCloudFile(connectionId, file.id, file.name),
    [attachCloudFile],
  )

  // Per-thread drafts: on thread switch, stash the outgoing thread's unsent
  // text and restore the incoming thread's stash (or empty). First mount is a
  // no-op (prevDraftKeyRef seeds to the current key). valueRef mirrors `value`
  // so the switch effect reads the LATEST text, not a stale closure.
  const valueRef = useRef(value)
  valueRef.current = value

  useEffect(() => {
    const prevKey = prevDraftKeyRef.current
    if (prevKey === draftKey) return
    const outgoing = valueRef.current
    if (outgoing.trim()) composerDraftsByThread.set(prevKey, outgoing)
    else composerDraftsByThread.delete(prevKey)
    setValue(composerDraftsByThread.get(draftKey) ?? "")

    // Phase 244 (244-05 T2, extracted at 244-06): an attachment belongs to the conversation it
    // was attached IN — the reason lives with the state now, in `useComposerAttachments`.
    clearAttachments()

    // The connector selection belongs to the CONVERSATION, not to the composer instance:
    // switching away and back must not quietly re-arm, or disarm, a set of services.
    activeConnectorsByThread.set(prevKey, activeConnectorIdsRef.current)

    // ⚠ Decision 2: key the restore on Map.has(), never on the value.
    if (activeConnectorsByThread.has(draftKey)) {
      const restored = activeConnectorsByThread.get(draftKey)!
      setActiveConnectorIds(restored)
      activeConnectorIdsRef.current = restored
    } else {
      let seeded = false
      if (messages && messages.length > 0) {
        for (let i = messages.length - 1; i >= 0; i--) {
          const msg = messages[i]
          if (msg.role === "user" && msg.activeConnectorIds !== undefined) {
            activeConnectorsByThread.set(draftKey, msg.activeConnectorIds)
            setActiveConnectorIds(msg.activeConnectorIds)
            activeConnectorIdsRef.current = msg.activeConnectorIds
            seeded = true
            break
          }
        }
      }
      if (!seeded) {
        setActiveConnectorIds([])
        activeConnectorIdsRef.current = []
      }
    }
    prevDraftKeyRef.current = draftKey
  }, [draftKey, messages])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [value])

  useEffect(() => {
    if (prefillMessage) {
      setValue(prefillMessage)
      onClearPrefill?.()
    }
  }, [prefillMessage, onClearPrefill])

  // Phase 154 (LANG-01 / D-03) — the mode labels sourced from the term-map (plain
  // by default; for these keys plain === technical, so the visible label is
  // unchanged). The one-line helper text lives on the same term-map rows.
  const generalLabel = usePlainLabel("agentmode.default")
  const explorerLabel = usePlainLabel("agentmode.explorer")

  const handleSend = () => {
    const trimmed = value.trim()
    if (!trimmed || disabled || workflowLocked) return
    // ⚠ ALWAYS THE ARRAY, NEVER `undefined`. `[] -> undefined` is exactly how "I turned
    // everything off" became "use everything": the backend's absent-arm offered every
    // enabled connection. Both ends now agree that absent and empty mean the same thing —
    // none — and the wire says which one the person chose.
    onSend(trimmed, activeConnectorIds)
    setValue("")
    // Phase 244 (244-05 T2): the pending chips have become SENT chips — the transcript renders
    // them from the thread's persisted workspace files now, so the composer lets them go.
    clearAttachments()
    // Per-thread drafts: a successful hand-off consumes the draft.
    composerDraftsByThread.delete(draftKey)
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Phase 092 (092-06 / F3): Send is also gated on the per-thread workflow lock.
  const canSend = !disabled && !workflowLocked && value.trim().length > 0
  const showProviderSelector = providers.length > 1 && selectedProvider && onProviderChange
  const showModelSelector = models.length > 1 && selectedModel && onModelChange

  const displayName = (model: string) => {
    if (model.length <= 32) return model
    return model.slice(0, 30) + "…"
  }

  const activeProviderLabel = selectedProvider
    ? (PROVIDER_LABELS[selectedProvider] ?? selectedProvider)
    : null

  const SelectedProviderMark = providerLogo(selectedProvider)
  const SelectedModelMark = modelLogo(selectedModel) ?? providerLogo(selectedProvider)

  // Cloud storage connections check
  const hasCloudStorage = connections.some(
    (c) =>
      c.service_id.includes("google") ||
      c.service_id.includes("workspace") ||
      c.service_id.includes("drive") ||
      c.service_id.includes("onedrive"),
  )

  // Phase 244 (244-05 T2 / D-244-26) — the ROW exists when EITHER an attachment or a connector
  // does, and not at all when neither does (S-2: no reserved empty space, the shipped behaviour).
  const armedConnectors = connections.filter((c) => activeConnectorIds.includes(c.id))
  const showChipsRow = pendingAttachments.length > 0 || armedConnectors.length > 0

  return (
    <div className="px-4 pb-3 bg-transparent">
      <div className="max-w-4xl mx-auto">
        {/* ── Phase 244 (244-05 T2 / D-244-27) — THE REFUSAL, as a REGION with THREE ATOMS ──
            The approved mockup (`sketch 236 index.html` § `refuseHTML`) draws, in this order:
            <b> the rejected FILENAME · <code> the server's VERBATIM 422 · <button class="ok">.
            ⛔ None of the three is optional. The revision pass found this block short two of
            its atoms IN THE BUILD, which is the silent narrowing D-244-27 exists to stop.
            ⚠ "a new attempt clears the error" is NOT a substitute for the dismiss control: a
            person who picks the wrong file and walks away must be able to put the composer back
            without uploading something else. */}
        {refusal && (
          <div
            role="alert"
            data-testid="composer-refusal"
            className={cn(
              "flex items-start gap-2 mb-2 px-3 py-2 rounded-lg",
              "border border-destructive/40 bg-destructive/10 text-xs",
            )}
          >
            <span data-refusal-file className="font-semibold text-foreground shrink-0 truncate max-w-[200px]">
              {refusal.fileName}
            </span>
            <span data-refusal-sentence className="flex-1 font-mono text-[11px] text-destructive">
              {refusal.message}
            </span>
            <button
              type="button"
              data-refusal-dismiss
              onClick={dismissRefusal}
              className={cn(
                "shrink-0 rounded-md border border-border px-2 py-0.5 font-medium text-foreground/80",
                "hover:bg-accent focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              )}
            >
              {COPY.shared.refusalDismiss}
            </button>
          </div>
        )}
        <div
          className={cn(
            "rounded-2xl ghost-border bg-card/80 backdrop-blur-sm shadow-lg shadow-primary/5 transition-all duration-200",
            "focus-within:ring-2 focus-within:ring-primary/30 focus-within:shadow-lg focus-within:shadow-primary/5",
          )}
        >
          {/* ── The chips row — HOISTED (Phase 244 / 244-05 T2 / D-244-26) ─────────────────
              The attachment chip is a SIBLING of the connector chip, in ONE row, never a new
              region beneath it. ⛔ A `children` slot inside `ActiveConnectorChips` was the
              wrong arm and the reason is measured: that component returns `null` on empty, so
              the attachment chip would VANISH for a person with no connector armed — exactly
              the one-item case D-244-26 orders checked. `ComposerAttach.composition.test.tsx`
              Test 4 is that ruling's executable form.
              ⚠ `data-testid="active-connector-chips"` lives here now so no existing suite
              silently loses its hook. */}
          {showChipsRow && (
            <div className="px-3 pt-2">
              <div
                data-testid="active-connector-chips"
                className="flex flex-wrap items-center gap-1.5 px-3 py-1.5 mb-1 bg-muted/40 rounded-lg border border-border/40"
              >
                {armedConnectors.length > 0 && (
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mr-1">
                    Using:
                  </span>
                )}
                {pendingAttachments.map((f) => (
                  <ChatAttachmentChip
                    key={f.path}
                    file={f}
                    state="pending"
                    onRemove={() => handleRemoveAttachment(f)}
                  />
                ))}
                <ActiveConnectorChips
                  connections={connections}
                  activeConnectorIds={activeConnectorIds}
                  onRemoveConnector={handleRemoveConnector}
                />
              </div>
            </div>
          )}

          {/* Text area */}
          <div className="px-4 pt-1 pb-1">
            <Textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={workflowLocked ? "Workflow running — Cancel to switch back" : "Ask anything…"}
              title={workflowLocked ? "Workflow running — Cancel to switch back" : undefined}
              disabled={disabled || workflowLocked}
              rows={1}
              className="w-full resize-none overflow-hidden min-h-[36px] border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 text-sm placeholder:text-muted-foreground/50"
            />
          </div>

          {/* Bottom toolbar */}
          <div className="flex items-center justify-between px-2 pb-2 pt-1">
            {/* Left: Plus menu + provider + model + agent mode */}
            <div className="flex items-center gap-1">
              {/* Plus Button Menu (Claude.ai style) */}
              <DropdownMenu open={plusMenuOpen} onOpenChange={setPlusMenuOpen} modal={false}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Add content and tools"
                    data-testid="composer-plus-btn"
                    className={cn(
                      "flex items-center justify-center h-7 w-7 rounded-full text-muted-foreground",
                      "hover:text-foreground hover:bg-muted/60 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      plusMenuOpen && "bg-muted text-foreground",
                      activeConnectorIds.length > 0 && "text-primary",
                    )}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="top" className="p-0 border-border/80 shadow-xl overflow-hidden mb-1">
                  {/* ── Phase 244 (244-05 T2 / D-244-22) — TWO DOORS, in the drawn order ─────
                      Sketch 236's variant A keeps the menu PLAIN: no header, no footer, nothing
                      about destination. ⛔ The promise lives on the CHIP, which is still on
                      screen while the person types and rides into the transcript — a menu is
                      read once and closed. B's header/footer stay recorded in the sketch under
                      `COPY.b` (D-244-23) and are fenced out by composition Test 3.
                      ⚠ The divider used to wrap the cloud item ALONE, so hiding it left a
                      dangling rule. The border now belongs to the group, which is always
                      non-empty because the local door is never gated. */}
                  <div data-testid="composer-attach-group" className="p-1 border-b border-border/50">
                    <DropdownMenuItem
                      onSelect={() => {
                        setPlusMenuOpen(false)
                        attachInputRef.current?.click()
                      }}
                      className="text-xs cursor-pointer gap-2 py-1.5"
                    >
                      <Paperclip className="h-4 w-4 text-primary" />
                      <span>{COPY.a.itemLocal}</span>
                    </DropdownMenuItem>
                    {hasCloudStorage && (
                      <DropdownMenuItem
                        onSelect={() => {
                          setPlusMenuOpen(false)
                          setFilePickerOpen(true)
                        }}
                        className="text-xs cursor-pointer gap-2 py-1.5"
                      >
                        <HardDrive className="h-4 w-4 text-primary" />
                        <span>{COPY.a.itemCloud}</span>
                      </DropdownMenuItem>
                    )}
                  </div>
                  {/* The third item in the contract's order. ⚠ The shipped `ConnectorsFlyout`
                      inlines the whole connectors panel rather than being a door, so this names
                      the SECTION it opens. ⛔ The flyout itself is NOT re-labelled: its own
                      "Connectors" header is asserted verbatim by `MessageInput.connectors.test.tsx`
                      (BASELINE 5), and renaming it to satisfy a word here would break a shipped
                      fence to make a new one pass. */}
                  <div className="px-3 pt-1.5 text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                    {COPY.a.itemConnectors}
                  </div>
                  <ConnectorsFlyout
                    activeConnectorIds={activeConnectorIds}
                    onToggleConnector={handleToggleConnector}
                    onClose={() => setPlusMenuOpen(false)}
                    onOpenConnections={onOpenConnections}
                  />
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Provider selector */}
              {showProviderSelector ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={cn(
                        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
                        "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                        "transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      )}
                    >
                      {SelectedProviderMark ? (
                        <SelectedProviderMark size={14} />
                      ) : (
                        <Layers className="h-3 w-3 shrink-0" />
                      )}
                      <span>{activeProviderLabel}</span>
                      <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" side="top" className="min-w-[160px] mb-1">
                    {providers.map((p) => {
                      const PMark = providerLogo(p.id)
                      return (
                        <DropdownMenuItem
                          key={p.id}
                          onSelect={() => onProviderChange!(p.id)}
                          className={cn(
                            "text-xs cursor-pointer gap-2",
                            p.id === selectedProvider && "font-medium bg-accent",
                          )}
                        >
                          {PMark ? (
                            <PMark size={14} />
                          ) : (
                            <Layers className="h-3 w-3 shrink-0 text-muted-foreground" />
                          )}
                          {PROVIDER_LABELS[p.id] ?? p.id}
                          {p.id === selectedProvider && (
                            <span className="ml-auto text-[10px] text-primary font-semibold">active</span>
                          )}
                        </DropdownMenuItem>
                      )
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : activeProviderLabel ? (
                <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground">
                  {SelectedProviderMark ? <SelectedProviderMark size={14} /> : <Layers className="h-3 w-3" />}
                  {activeProviderLabel}
                </span>
              ) : null}

              {/* Model selector */}
              {showModelSelector ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={cn(
                        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
                        "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                        "transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      )}
                    >
                      {SelectedModelMark ? (
                        <SelectedModelMark size={14} />
                      ) : (
                        <Cpu className="h-3 w-3 shrink-0" />
                      )}
                      <span>{displayName(selectedModel!)}</span>
                      <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" side="top" className="min-w-[200px] mb-1">
                    {models.map((m) => {
                      const info = MODEL_INFO[m]
                      const isDeprecated = deprecatedModels?.has(m) ?? false
                      // Phase 249 (MODEL-05) — THE PICK-TIME WARNING.
                      //
                      // ⚠ The guard is `size > 0`, not `!== undefined`. An empty set is the
                      // honest "we were not told" state — an older backend omits the field, and
                      // treating that as "nothing is registered" would flag every model in the
                      // product. Silence must degrade to no claim, never to a false one.
                      const isUnverified =
                        (verifiedModels?.size ?? 0) > 0 && !verifiedModels!.has(m)
                      // ⛔ CR-02: tool loss is a claim about RESOLVED CAPABILITY, and it is
                      // INDEPENDENT of registry membership. A model the operator added is
                      // registered (no "unverified") and can still run with tools off — which is
                      // the DEFAULT for a self-hosted row whose Native-tools field was left unset.
                      // Guarding the chip on `isUnverified` alone made the warning go silent on
                      // exactly the models MODEL-04 unblocked.
                      const isToolsLost = toolsLostModels?.has(m) ?? false
                      const marked = isUnverified || isToolsLost
                      // Phase 149 (D-149-17) + model-icons pass: the model's OWN
                      // family mark per row (Claude/Gemini/Llama/… — MORE specific than the
                      // provider mark, and it differentiates rows within one provider, e.g.
                      // OpenRouter), falling back to the provider mark, then the Cpu glyph.
                      // Capability info stays DEMOTED to the hover tooltip so the model name
                      // stays primary (the operator's "context info makes it not very good"
                      // cleanup — visual-only). Single-source @lobehub (ICON CONVENTION).
                      const ModelMark = modelLogo(m) ?? providerLogo(selectedProvider)
                      const capTooltip = info
                        ? `${(info.contextWindow / 1000).toFixed(0)}k context · ${info.maxOutputTokens.toLocaleString()} output · ${info.bestFor} · Cost tier: ${info.costTier === 'low' ? 'Low ($)' : info.costTier === 'mid' ? 'Mid ($$)' : 'High ($$$)'}`
                        : undefined
                      return (
                        <DropdownMenuItem
                          key={m}
                          onSelect={() => onModelChange!(m)}
                          title={capTooltip}
                          className={cn(
                            "text-xs cursor-pointer items-center gap-2 py-1.5",
                            m === selectedModel && "font-medium bg-accent",
                          )}
                        >
                          {ModelMark ? (
                            <ModelMark size={13} />
                          ) : (
                            <Cpu className="h-3 w-3 shrink-0 text-muted-foreground" />
                          )}
                          <span className="min-w-0 flex-1 truncate">{m}</span>
                          {marked && (
                            <span
                              className="text-[9px] font-medium text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded-full ghost-border shrink-0"
                              title={unverifiedDescription(
                                m,
                                inferredProviderFor ?? {},
                                toolsLostModels ?? EMPTY_MODEL_SET,
                                !isUnverified,
                              )}
                              aria-label={unverifiedDescription(
                                m,
                                inferredProviderFor ?? {},
                                toolsLostModels ?? EMPTY_MODEL_SET,
                                !isUnverified,
                              )}
                            >
                              {/* A registered model is not "unverified" — saying so would be
                                  false. It gets the label for what is actually wrong with it. */}
                              {isUnverified ? UNVERIFIED.LABEL : NO_TOOLS_LABEL}
                            </span>
                          )}
                          {isDeprecated && (
                            <span
                              className="text-[9px] font-medium text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded-full ghost-border shrink-0"
                              title="This model is deprecated. It still works, but consider moving to a newer model."
                            >
                              deprecated
                            </span>
                          )}
                          {m === selectedModel && (
                            <span className="text-[10px] text-primary font-semibold shrink-0">active</span>
                          )}
                        </DropdownMenuItem>
                      )
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                selectedModel && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground">
                    {SelectedModelMark ? <SelectedModelMark size={14} /> : <Cpu className="h-3 w-3" />}
                    {displayName(selectedModel)}
                  </span>
                )
              )}

              {/* Agent mode selector (General/Explorer) — D-03: disabled-with-
                  tooltip while workflow-locked (controlled by the active
                  workflow), NOT hidden (avoids the layout jump). */}
              {onAgentModeChange && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild disabled={workflowLocked}>
                    <button
                      disabled={workflowLocked}
                      title={
                        workflowLocked
                          ? "Controlled by the active workflow"
                          : undefined
                      }
                      className={cn(
                        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
                        "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                        "transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        agentMode === "explorer" && "text-primary bg-primary/10",
                        workflowLocked && "opacity-40 cursor-not-allowed hover:bg-transparent hover:text-muted-foreground",
                      )}
                      data-testid="agent-mode-selector"
                    >
                      <Compass className="h-3 w-3 shrink-0" />
                      <span>{agentMode === "explorer" ? "Explorer" : "General"}</span>
                      <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" side="top" className="min-w-[160px] mb-1">
                    <DropdownMenuItem
                      onSelect={() => onAgentModeChange("default")}
                      className={cn("text-xs cursor-pointer gap-2 items-start", agentMode === "default" && "font-medium bg-accent")}
                    >
                      <Cpu className="h-3 w-3 shrink-0 text-muted-foreground mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span>{generalLabel}</span>
                          {agentMode === "default" && <span className="ml-auto text-[10px] text-primary font-semibold">active</span>}
                        </div>
                        {/* Phase 154 — one-line plain helper off the term-map (additive). */}
                        <p className="text-[10px] font-normal text-muted-foreground mt-0.5">{TERM_MAP["agentmode.default"].helper}</p>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => onAgentModeChange("explorer")}
                      className={cn("text-xs cursor-pointer gap-2 items-start", agentMode === "explorer" && "font-medium bg-accent")}
                    >
                      <Compass className="h-3 w-3 shrink-0 text-muted-foreground mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span>{explorerLabel}</span>
                          {agentMode === "explorer" && <span className="ml-auto text-[10px] text-primary font-semibold">active</span>}
                        </div>
                        {/* Phase 154 — one-line plain helper off the term-map (additive). */}
                        <p className="text-[10px] font-normal text-muted-foreground mt-0.5">{TERM_MAP["agentmode.explorer"].helper}</p>
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

            </div>

            {/* Right: stop (while streaming) or send button */}
            <div className="flex items-center gap-2.5">
              {!disabled && (
                <span className="text-[10px] text-muted-foreground hidden sm:block">
                  Enter ↵ · Shift+Enter for newline
                </span>
              )}
              {disabled ? (
                /* Phase 194.1 Plan 04 (RUN-01 / R1 + R2 / D-05) — the composer owns
                   NO Stop state and NO Stop dispatcher. `StopControl` reads the
                   StreamsProvider stopping slice and calls `stopThread(threadId)`
                   itself, which is Phase 194 D-08 (*four mounts, ONE mechanism*)
                   made structural on the DISPLAY half too, not only the runtime one.

                   ⚠ `threadId` is not a new prop: `Props` has declared it since
                   099-08 (per-thread drafts). And gating the control on it loses no
                   live case — `ChatArea.tsx` passes `disabled={isStreaming}` where
                   `isStreaming = useStreamingForThread(thread?.id ?? null)`, which is
                   `false` whenever there is no thread, so `disabled` true implies a
                   thread exists.

                   ⚠ D-22: this arm used to dispatch the removed prop → `stopStreaming`
                   → `actions.stopStream`, NOT `stopThread`. Routing it at `stopThread`
                   is behaviour-preserving — after plan 03 the two resolver bodies are
                   mirrors and `stopStream` resolves `activeThreadIdRef.current`, which
                   IS this composer's thread — and it retires the second resolver as a
                   consequence rather than as extra scope. */
                <StopControl threadId={threadId ?? null} variant="composer" />
              ) : (
                <Button
                  onClick={handleSend}
                  disabled={!canSend}
                  size="icon"
                  aria-label="Send message"
                  data-testid="composer-send"
                  className={cn(
                    "h-8 w-8 rounded-lg shrink-0 transition-all",
                    canSend && "gradient-primary hover:opacity-90 shadow-sm shadow-primary/20",
                  )}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground text-center mt-2.5">
          AI can make mistakes. Verify important information.
        </p>
      </div>

      {/* ── Phase 244 (244-05 T2) — the local door's hidden input ──────────────────────────
          ⛔ MOUNTED OUTSIDE THE DROPDOWN ON PURPOSE. Radix unmounts `DropdownMenuContent` when
          the menu closes, and `onSelect` closes it — an input living in there would be gone
          before the OS file dialog ever resolved.
          ⛔ `accept` READS the fenced constant. It is a UX hint only (T-244-05-01): the real
          gate is `validate_upload`'s magic-byte + container checks, which is why this must never
          be widened to make anything pass. */}
      <input
        ref={attachInputRef}
        type="file"
        data-testid="composer-attach-input"
        accept={WORKSPACE_ACCEPT_ATTR}
        aria-label={COPY.a.itemLocal}
        tabIndex={-1}
        className="hidden"
        onChange={onAttachInputChange}
      />

      {/* ── Phase 244 (244-06 T3 / D-244-05 / BUG-260905-01) — THE CLOUD DOOR, RE-POINTED ──
          ⛔ This mount used to carry `onFileImported`, which appended `Attached file: <name>`
          into the person's DRAFT — the arm D-244-02 rejects in writing ("it edits the person's
          words"). It is gone, and it left in the SAME COMMIT as the re-point on purpose: the
          two behaviours must never both be live, and removing the text edit alone would have
          left the cloud door doing nothing visible at all.
          ⭐ The pick now lands in `workspace_files` for THIS thread, so both composer doors
          mean the same thing and neither writes a `documents` row. */}
      <ConnectedFilePickerModal
        open={filePickerOpen}
        onOpenChange={setFilePickerOpen}
        connections={connections}
        onConfirm={handleAttachCloudFile}
      />
    </div>
  )
}

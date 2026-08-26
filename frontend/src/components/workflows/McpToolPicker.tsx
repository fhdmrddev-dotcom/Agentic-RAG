/**
 * Phase 206 (CONN-02 / CONN-03 / D-206-05 / D-206-06 / F-1 / F-2 / F-7) —
 * McpToolPicker: Leaf component for discovering, selecting, and configuring MCP tools.
 *
 * ── ZERO-HOOK PIN DELEGATION (F-7) ──
 * `PhaseFormPanel.tsx` has a strict zero-hook pin (0 useState / 0 useEffect / 0 useMemo)
 * guarded by `PhaseFormPanel.test.tsx:668`. All state for tool discovery, selection,
 * argument editing, and grant verification lives exclusively inside this leaf component.
 *
 * ── PER-TOOL GRANT PREDICATE (F-1 / F-2) ──
 * Boolean mapping `{ [tool_name: string]: boolean }`.
 * Evaluated strictly via `Object.prototype.hasOwnProperty.call(grants, toolName) && Boolean(grants[toolName])`.
 *
 * ── 206.2-04: THE GRANT WRITE, AND WHY IT LIVES HERE (D-206.2-22) ──
 * `updateConnectorGrants` shipped in Phase 206 with ZERO production callers, while the
 * engine's gate is `tool_grants.get(tool_name) is True` — A MISSING KEY DENIES. So a step
 * could be bound to an MCP tool that could never be granted: a second built-but-unreachable
 * feature sitting behind the first. This file is where the switch goes, and the reason is
 * mechanical rather than aesthetic: `PhaseFormPanel.tsx` holds an ABSOLUTE-ZERO hook pin and
 * `ExternalActionSection.tsx`'s own source fence forbids `useContext` — which `useOrgOptional`
 * uses. This module carries neither fence and already holds the state for this card.
 *
 * ── D-206.2-05, ANSWERED AT THE CONTROL'S OWN SITE ──
 * SEED-146's standing rule is *never add an outbound capability before the approval model
 * exists*. THE PER-TOOL GRANT **IS** THE APPROVAL MODEL FOR THIS SURFACE. Phase 206 shipped
 * the egress, the SSRF guard, the dispatch, the enforcement and the `tool_refused` receipt;
 * the only missing piece was the human-facing switch the enforcement already reads. This
 * phase therefore adds NO NEW OUTBOUND CAPABILITY — it makes an existing, already-fenced one
 * approvable by a person instead of by a hand-edited database row.
 */

import { useCallback, useState } from "react"
import { AlertTriangle, CheckCircle2, RefreshCw, Wrench } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { discoverConnectorTools, updateConnectorGrants } from "@/lib/api"
import type { ConnectorConnection, McpDiscoveredTool } from "@/lib/api"
// ⚠ `useOrgOptional`, NEVER `useOrg` — the latter THROWS outside a provider and six shipped
// suites mount this component's ancestors without one. `canManage` decides RENDERING ONLY;
// `require_org_manage` plus an RLS policy in both USING and WITH CHECK are the wall.
import { useOrgOptional } from "@/providers/OrgProvider"

/* ─────────────────────────────────────────────────────────────────────────────────────
 * ⚠ 211-04 (D-211-12) — THE VALUES BELOW CHANGED; NOT ONE IDENTIFIER DID, and not one
 * `data-testid` moved. Five of them said *tools* / *discover* / *remote server*, which read
 * as a remote-server act — and this card now serves a first-party capability connection as
 * well, whose action list is REFRESHED from the server we already own rather than DISCOVERED
 * from someone else's. Renaming the identifiers or the test ids would be churn with no defect
 * behind it: `mcp-tool-picker`, `mcp-discover-btn`, `mcp-no-tools`, `mcp-tool-select` and the
 * `mcp-grant-*` family are pinned across three suites.
 * ───────────────────────────────────────────────────────────────────────────────────── */

/** The card's own name. Shape-neutral: it heads the list of things THIS CONNECTION can do,
 *  whether those arrived from a remote MCP server or from plan 211-01's static descriptor. */
export const MCP_TOOL_PICKER_HEADING = "What this connection can do"
export const MCP_DISCOVER_BUTTON_LABEL = "Refresh actions"
export const MCP_DISCOVERING_LABEL = "Refreshing…"
export const MCP_NO_TOOLS_DISCOVERED =
  "No actions listed for this connection yet. Refresh to fetch what it offers."
export const MCP_TOOL_SELECT_LABEL = "Action"
export const MCP_TOOL_NONE_OPTION = "— choose an action —"
export const MCP_GRANT_GRANTED_LABEL = "Permission Granted"
export const MCP_GRANT_DENIED_LABEL = "Permission Not Granted"
export const MCP_GRANT_DENIED_WARNING =
  "This tool is not granted permission on this connection. Execution will be refused by policy at run time."
export const MCP_TOOL_ARGS_LABEL = "Tool Arguments (JSON)"

// ── 206.2-04 · the grant control's copy. Every one is an exported identifier, because a
//    sentence living inline inside JSX is a sentence nobody can test for drift.

/** ⚠ *on this connection*, NOT *for this step*. `PATCH /grants` writes a column on the
 *  CONNECTION, org-wide — a label saying *this step* would be a lie the API itself refuses
 *  to make true. */
export const MCP_GRANT_TOGGLE_LABEL = "Allow this tool on this connection"

/** D-206.2-05 in the person's own words. ⚠ IT MUST NOT BE TRIMMED TO ONE CLAUSE — the second
 *  clause is the org-wide consequence, and it is the whole reason this reads as a governance
 *  write rather than as a preference toggle. */
export const MCP_GRANT_SCOPE_NOTE =
  "This permission belongs to the connection, not to this step. Every workflow in this organisation that uses this connection may call the tools allowed here."

/** ⚠ REQUIRED BY THE NO-OPTIMISTIC-FLIP RULE, not decoration: the switch deliberately does
 *  not move on press, so without this reading the control looks broken to the person who
 *  just pressed it. One dim word, no spinner — `CONNECTION_PICKER_LOADING`'s register. */
export const MCP_GRANT_SAVING = "Saving…"

/** The Control-Room ✎ write mark (Phases 146-148): a receipt says *a write happened*, never
 *  *a consequence occurred*. TWO DIRECTIONS, TWO RECEIPTS — a single "Saved" would hide
 *  which way it went. */
export const MCP_GRANT_RECEIPT_ALLOWED = "✎ Allowed"
export const MCP_GRANT_RECEIPT_DENIED = "✎ Not allowed"

/** ⚠ It must not appear on a 403 — a member is never shown this control at all, so this line
 *  means a real failure and not a refusal. */
export const MCP_GRANT_WRITE_FAILED = "Couldn't change that permission — try again."

/** THE EXPLANATORY ABSENCE. It carries BOTH facts a member needs — *why there is no switch*
 *  and *what happens anyway* — because removal alone folds two facts into one, which is the
 *  defect this tree has now recorded five times. */
export const MCP_GRANT_ADMIN_ONLY_NOTE =
  "Tool permissions belong to the connection and only an organisation admin can change them. You can still bind this step — a tool that is not allowed is refused when the run reaches it."

/** ⚠ A MEASURED LIE THIS PHASE WOULD OTHERWISE SHIP. `MCP_NO_TOOLS_DISCOVERED` above tells
 *  the reader to click a button that AR-01 removes for them. This names NO second location,
 *  because nothing was measured that lets a member reach discovery anywhere. */
export const MCP_NO_TOOLS_ADMIN_ONLY =
  "No actions have been listed for this connection yet. Only an organisation admin can refresh them."

export interface McpToolPickerProps {
  connection: ConnectorConnection | null
  toolName?: string | null
  toolArgs?: Record<string, unknown> | null
  onSelectTool?: (toolName: string) => void
  onChangeArgs?: (args: Record<string, unknown>) => void
  /**
   * THE FRESHNESS ROUTE — *adopt the response row* — and it is not an optimisation.
   *
   * `updateConnectorGrants` returns the full updated `ConnectorConnection`, so the parent
   * replaces its matching entry and the badge, the switch and the NEXT toggle's merge base
   * all re-derive from one server-owned value. ⚠ WITHOUT IT THE TWO GO OUT OF SYNC AND THE
   * NEXT TOGGLE MERGES FROM A STALE MAP — which, against a whole-column REPLACE, is a silent
   * lost update. The rejected alternative is a re-fetch nonce: it re-issues the whole
   * connection list on every toggle inside a 400px panel field, and the response IS the row.
   */
  onConnectionUpdated?: (row: ConnectorConnection) => void
  disabled?: boolean
  /**
   * 211-04 — WHETHER `tool_grants` IS ACTUALLY ENFORCED FOR THE BOUND CONNECTION.
   *
   * ⚠ IT IS A PROP RATHER THAN A LOCAL READ, AND THAT IS THE WHOLE POINT. D-211-12 requires
   * this component to take NO rendering decision from the connection's endpoint — its own
   * suite sweeps the live source for that field and finds zero occurrences. But the grant
   * gate really IS endpoint-shaped on the server: `phase_types.py` reads `tool_grants` only
   * INSIDE its remote-server branch (Gate 6), so on the capability path a step is not refused by
   * that map at all. Rendering *"Permission Not Granted — execution will be refused by policy
   * at run time"* over a first-party connection would therefore be a measured lie.
   *
   * So the CALLER — which is allowed to know a connection's shape — answers the question, and
   * this component renders the consequence. Default `true`, which is what keeps every shipped
   * MCP call site and every shipped assertion byte-unmoved.
   *
   * ⚠ THIS OBLIGATION IS CREATED BY THIS PLAN AND DISCHARGED BY IT. Before the card rendered
   * for a bound capability row, the sentence could not appear on one; making the card render
   * is what put it there.
   */
  grantsEnforced?: boolean
}

/** Which of the two audiences on this panel is looking, or that we do not yet know.
 *  ⚠ `no-provider` and `probing` are BOTH unmeasured, and they are kept apart on purpose —
 *  see `audienceOf` below. */
export type McpGrantAudience = "admin" | "member" | "probing" | "no-provider"

/** Check whether a tool is granted permission strictly per F-1 / F-2. */
export function isToolGranted(
  grants: Record<string, boolean> | undefined | null,
  toolName: string | null | undefined,
): boolean {
  if (!grants || !toolName) return false
  return (
    Object.prototype.hasOwnProperty.call(grants, toolName) &&
    Boolean(grants[toolName])
  )
}

/**
 * The render decision, and the ONLY place it is made.
 *
 * ⚠ FOUR ARMS, NOT THREE, AND THE FOURTH IS LOAD-BEARING. `no-provider` (a null context)
 * and `probing` (a real caller whose org probe is still in flight) are both *unmeasured*,
 * and the UI-SPEC folds them into one `unknown`. They are split here for a measured reason:
 *
 *  · `probing` is the only UNMEASURED case that can happen to a REAL PERSON — `OrgProvider`
 *    wraps the whole app — so it hides the Discover button, because AR-01's hard rule is
 *    that a non-admin must never see a button that 403s, and during the probe we do not yet
 *    know that they are not one.
 *  · `no-provider` happens only where no provider is mounted: this component's own suite,
 *    `ExternalActionSection.test.tsx`, `PhaseFormPanel.rails.test.tsx` and the four
 *    `WorkflowBuilderPage.*` suites. There it renders EXACTLY what it rendered before this
 *    phase — the arm's whole contract is *adds zero new nodes*, and removing the shipped
 *    Discover button would be a REMOVAL, which is a different (and unasked-for) change.
 *
 * Neither arm renders the switch, the scope note or any sentence: printing *only an
 * organisation admin can…* while the probe is in flight would state a fact about the caller
 * that has not been measured, which is the fabrication this project refuses everywhere else.
 */
export function audienceOf(
  org: { canManage: boolean; loading: boolean } | null | undefined,
): McpGrantAudience {
  if (org === null || org === undefined) return "no-provider"
  if (org.canManage === true) return "admin"
  if (org.loading === true) return "probing"
  return "member"
}

export function McpToolPicker({
  connection,
  toolName = "",
  toolArgs = {},
  onSelectTool,
  onChangeArgs,
  onConnectionUpdated,
  disabled = false,
  grantsEnforced = true,
}: McpToolPickerProps) {
  const [isDiscovering, setIsDiscovering] = useState(false)
  const [discoveryError, setDiscoveryError] = useState<string | null>(null)
  const [localDiscoveredTools, setLocalDiscoveredTools] = useState<
    McpDiscoveredTool[] | null
  >(null)
  const [argsJsonString, setArgsJsonString] = useState<string>(() =>
    toolArgs && Object.keys(toolArgs).length > 0
      ? JSON.stringify(toolArgs, null, 2)
      : ""
  )
  const [jsonError, setJsonError] = useState<string | null>(null)

  // ── 206.2-04 · the grant write's TRANSIENT state, and nothing else ──────────────────
  // The switch's POSITION is not in here, deliberately: it is derived from the connection
  // prop on every render. `FeatureVisibility.tsx:194-195` says the same thing about its own
  // audience value — *"the audience value itself is the shell's source of truth (no
  // optimistic flip)"* — and that is the shape copied here.
  const [grantBusy, setGrantBusy] = useState(false)
  const [grantFailed, setGrantFailed] = useState(false)
  const [grantReceipt, setGrantReceipt] = useState<string | null>(null)

  const audience = audienceOf(useOrgOptional())

  const tools: McpDiscoveredTool[] =
    localDiscoveredTools ?? connection?.discovered_tools ?? []

  const handleDiscover = useCallback(async () => {
    if (!connection?.id) return
    setIsDiscovering(true)
    setDiscoveryError(null)
    try {
      const result = await discoverConnectorTools(connection.id)
      setLocalDiscoveredTools(result)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to discover tools"
      setDiscoveryError(msg)
    } finally {
      setIsDiscovering(false)
    }
  }, [connection?.id])

  const handleToolChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const selected = e.target.value
      if (onSelectTool) {
        onSelectTool(selected)
      }
    },
    [onSelectTool]
  )

  const handleArgsChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value
      setArgsJsonString(val)
      if (!val.trim()) {
        setJsonError(null)
        if (onChangeArgs) onChangeArgs({})
        return
      }
      try {
        const parsed = JSON.parse(val)
        if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
          setJsonError(null)
          if (onChangeArgs) onChangeArgs(parsed as Record<string, unknown>)
        } else {
          setJsonError("Arguments must be a JSON object")
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Invalid JSON syntax"
        setJsonError(msg)
      }
    },
    [onChangeArgs]
  )

  /**
   * ── D-206.2-16 ── THE WRITE, AND THE NAIVE VERSION IS A LOST-UPDATE BUG THAT TYPECHECKS.
   *
   * `connector_service.update_connection_grants` does `.update({"tool_grants": sanitized})`
   * (`connector_service.py:786-793`) — A WHOLE-COLUMN REPLACE. A payload of
   * `{ [tool]: next }` alone therefore WIPES EVERY OTHER GRANT ON THE CONNECTION, silently,
   * on a column that decides whether real egress is permitted. `206.2-01` added the first
   * backend case asserting exactly that REPLACE semantics; this is the client half.
   *
   * Four parts, all copied from the ONE shipped UI toggle whose write sends a whole
   * collection (`admin/FeatureVisibility.tsx:213-258`):
   *   1. the FULL MERGED MAP, derived from `connection` — THE SERVER-OWNED PROP, never a
   *      `useState` copy, because a local copy is exactly how the merge base goes stale;
   *   2. `if (grantBusy) return` first, so two concurrent PATCHes cannot race on one column;
   *   3. NO OPTIMISTIC FLIP — the switch moves when the row it renders from changes;
   *   4. a ✎ receipt on success and a plain-language retry on failure, never a silent one.
   *
   * ⚠ IT IS STILL A READ-MODIFY-WRITE OVER A CLIENT SNAPSHOT. Two admins in two browsers can
   * clobber each other, and `tool_grants` carries no version column — adding one is a
   * migration this phase forbids. THE HONEST MITIGATION IS THE SCOPE SENTENCE, NOT A LOCK:
   * `MCP_GRANT_SCOPE_NOTE` says the permission is connection-wide, which is the fact a second
   * author needs. Re-open trigger: *a second writer of `tool_grants` appearing anywhere in
   * the builder, or the first observed clobber.*
   */
  const handleToggleGrant = useCallback(async () => {
    if (grantBusy) return
    const id = connection?.id
    if (!id || !toolName) return
    const next = !isToolGranted(connection?.tool_grants, toolName)
    setGrantBusy(true)
    setGrantFailed(false)
    try {
      const row = await updateConnectorGrants(id, {
        ...(connection?.tool_grants ?? {}),
        [toolName]: next,
      })
      setGrantReceipt(next ? MCP_GRANT_RECEIPT_ALLOWED : MCP_GRANT_RECEIPT_DENIED)
      window.setTimeout(() => setGrantReceipt(null), 4000)
      if (onConnectionUpdated) onConnectionUpdated(row)
    } catch {
      setGrantFailed(true)
    } finally {
      setGrantBusy(false)
    }
  }, [grantBusy, connection, toolName, onConnectionUpdated])

  // ── ⭐ 211-04 (D-211-12 / T-211-22) · THE CARD GATE — and it is ONE OF TWO GATES, never
  //    the one gate this line used to be. ──────────────────────────────────────────────
  //
  // ⚠ WHAT WAS HERE: an early return on the connection's SERVER-URL field being absent.
  // (The field is deliberately not spelled anywhere in this file, including here — this
  // component's own suite sweeps its live source for that token and a comment quoting it
  // would make the fence count itself. That is the 187-24 trap, and it has now fired
  // fourteen times in this tree.) It conflated two different decisions — *should this card
  // exist?* and *is there a list to show?* — and it answered BOTH from the endpoint. A bound
  // capability connection carrying a perfectly
  // shaped `discovered_tools` list therefore rendered NOTHING, which is why plan 211-01's
  // descriptors had no surface able to display them.
  //
  // ⚠ AND THE OBVIOUS REPLACEMENT IS A WORSE DEFECT, WHICH IS WHY THIS COMMENT IS LONG.
  // *"Render when `discovered_tools.length > 0`, else return null"* reads like the honest
  // form of D-211-12 and closes a loop with no way out through the UI: the list is empty →
  // the card returns null → the Refresh control (which lives BELOW this line) never renders →
  // nothing can populate the list → the card never renders. It would ALSO regress the MCP
  // path, where a brand-new connection legitimately starts with `discovered_tools: []` and
  // the Discover button is its only affordance. **Do not write that gate.**
  //
  // So: the CARD gates on BOUNDNESS — the honest question, because this component is only
  // ever mounted after an author has chosen a connection: *you have chosen a connection, here
  // is what it can do*. The TOOL LIST gates on `tools`, below, where it always did. And the
  // endpoint decides nothing about rendering anywhere in this file — asserted mechanically by
  // a source fence in this component's own suite, not merely promised here.
  if (!connection?.id) {
    return null
  }

  const selectedTool = tools.find((t) => t.name === toolName)
  const isGranted = isToolGranted(connection.tool_grants, toolName)
  // ⚠ THE ONE GRANT PREDICATE, NOT FORKED. `isToolGranted` already mirrors the server's
  // `grants.get(tool_name) is True`; the switch and the badge both read THIS value, so the
  // control can never disagree with the reading printed beside it.
  const canWriteGrants = audience === "admin" && grantsEnforced
  const showDiscover = audience === "admin" || audience === "no-provider"
  const grantWriteState = grantFailed ? "failed" : grantBusy ? "pending" : "idle"

  return (
    <div
      data-testid="mcp-tool-picker"
      className="mt-3 flex flex-col gap-2.5 rounded-md border border-border bg-card/60 p-3 text-xs"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <Wrench className="h-3.5 w-3.5 text-primary" />
          <span>{MCP_TOOL_PICKER_HEADING}</span>
        </div>
        {/* ⚠ AR-01 — REMOVED for a measured member, not `aria-disabled`. A control is
            OFFERED-AND-REFUSED when the thing blocking it is fixable by the same person
            (Gate 1's failing credential); it is REMOVED when that person can never make it
            work, and an org role is not fixable by whoever is looking at it. `/discover` is
            `require_org_manage`, so a rendered button here would 403. */}
        {showDiscover && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="mcp-discover-btn"
          disabled={disabled || isDiscovering || !connection.id}
          onClick={handleDiscover}
          className="h-6 gap-1 px-2 text-[11px]"
        >
          <RefreshCw
            className={`h-3 w-3 ${isDiscovering ? "animate-spin" : ""}`}
          />
          <span>
            {isDiscovering
              ? MCP_DISCOVERING_LABEL
              : MCP_DISCOVER_BUTTON_LABEL}
          </span>
        </Button>
        )}
      </div>

      {discoveryError && (
        <p
          role="alert"
          data-testid="mcp-discovery-error"
          className="text-[11px] text-destructive"
        >
          {discoveryError}
        </p>
      )}

      {tools.length === 0 ? (
        <p
          data-testid="mcp-no-tools"
          className="text-[11px] text-muted-foreground"
        >
          {/* ⚠ The shipped sentence tells the reader to click a button AR-01 has removed
              for them. Saying it to someone who cannot act on it is a measured lie, so the
              MEMBER arm gets its own sentence — and only that arm, because the two
              unmeasured arms make no claim about the caller at all. */}
          {audience === "member" ? MCP_NO_TOOLS_ADMIN_ONLY : MCP_NO_TOOLS_DISCOVERED}
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="mcp-tool-select"
            className="text-[11px] font-normal text-muted-foreground"
          >
            {MCP_TOOL_SELECT_LABEL}
          </Label>
          <select
            id="mcp-tool-select"
            data-testid="mcp-tool-select"
            value={toolName || ""}
            disabled={disabled}
            onChange={handleToolChange}
            className="h-8 rounded border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">{MCP_TOOL_NONE_OPTION}</option>
            {/* ⚠ 211-04 — THE VALUE IS THE WIRE NAME, THE LABEL IS THE HUMAN ONE. Plan
                211-01 widened the sanitizer's allow-list by exactly `title` and
                `outputSchema` so a descriptor could carry its own words; this is the one
                place that reads the first of them. `||` rather than `??` on purpose: the
                sanitizer omits the key for a blank, but a `title` that arrived as `""` from
                any other route must still fall through to the name rather than render an
                empty option. */}
            {tools.map((t) => (
              <option key={t.name} value={t.name}>
                {t.title || t.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {toolName && (
        <div className="mt-1 flex flex-col gap-2">
          {/* Grant Status Indicator.
              ⚠ 211-04 — GATED ON `grantsEnforced`, and the gate is a correctness fix rather
              than a preference. `MCP_GRANT_DENIED_WARNING` says the run will be *refused by
              policy*; on the capability path the executor never consults `tool_grants`, so
              that sentence would be false for a first-party connection. The badge, the
              switch and the member sentence are ONE surface about ONE mechanism, so they
              appear and disappear together — leaving the badge while removing the switch
              would stage the lie without its explanation. */}
          {grantsEnforced && (
          <div
            data-testid="mcp-grant-status"
            data-granted={isGranted ? "true" : "false"}
            className={`flex items-center gap-1.5 rounded px-2 py-1 text-[11px] ${
              isGranted
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
            }`}
          >
            {isGranted ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                <span className="font-medium">{MCP_GRANT_GRANTED_LABEL}</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <div>
                  <div className="font-medium">{MCP_GRANT_DENIED_LABEL}</div>
                  <div className="text-[10px] leading-tight text-muted-foreground">
                    {MCP_GRANT_DENIED_WARNING}
                  </div>
                </div>
              </>
            )}
          </div>
          )}

          {/* ── 206.2-04 · THE GRANT CONTROL ────────────────────────────────────────
              ⚠ OUTSIDE THE BADGE, NOT INSIDE IT. The badge above is a tinted box carrying
              STATE; nesting a control in it is how a state reading starts looking like a
              button — and it would put a control inside the one region SC#2c requires to
              pass unedited.

              ⚠ AND IT SPENDS NO COLOUR. A token-green switch (`--success`, hue 142) beside
              the shipped emerald badge (hue 160) would put two different greens meaning the
              same thing two lines apart, and a raw-emerald one would extend a bounded
              palette exception. The differentiator is the THUMB'S POSITION plus
              its switch role plus `aria-checked`. No new accent site: the reserved list is the
              focus ring and the Wrench glyph, and a third KIND would be a contract violation.

              ⚠ AR-06 — a NATIVE button carrying the switch role, not a vendored primitive.
              `src/components/ui/switch.tsx` does not exist (sixteen are vendored and Switch
              is not one), so `npx shadcn add switch` would put a registry block into a phase
              that otherwise installs nothing. The geometry is copied verbatim from the ONE
              shipped switch in this tree (`admin/ModelRegistryTab.tsx:823-854`), so no new
              spacing value and no new transform value enters the surface.

              ⚠ THE WHOLE ROW IS THE TARGET. Every control on this panel is 24-32px tall,
              far under the 44px touch guideline, and the switch inherits that deliberately —
              a 44px switch would read as the most important control on a 400px panel. The
              mitigation is required rather than optional: the switch and its label are ONE
              button spanning the row's full width, a ~26px x ~370px target. */}
          {canWriteGrants && (
            <>
              <button
                type="button"
                role="switch"
                aria-checked={isGranted}
                {...(grantBusy ? { "aria-busy": "true" } : {})}
                data-testid="mcp-grant-toggle"
                data-grant-write={grantWriteState}
                disabled={disabled}
                onClick={handleToggleGrant}
                className="mt-1 flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span
                  aria-hidden="true"
                  className={`relative inline-flex h-4 w-7 flex-none items-center rounded-full transition-colors ${
                    isGranted ? "bg-foreground/25" : "bg-muted-foreground/25"
                  }`}
                >
                  <span
                    className={`inline-block h-3 w-3 transform rounded-full bg-background shadow transition-transform ${
                      isGranted ? "translate-x-[13px]" : "translate-x-0.5"
                    }`}
                  />
                </span>
                <span>{MCP_GRANT_TOGGLE_LABEL}</span>
              </button>

              {/* The switch does not move on press, so this reading is what tells the person
                  their press was heard. Both receipts name their DIRECTION: a single "Saved"
                  would hide which way it went. */}
              {(grantBusy || grantReceipt !== null) && (
                <p
                  role="status"
                  data-testid="mcp-grant-write-state"
                  className="text-[10px] leading-tight text-muted-foreground"
                >
                  {grantBusy ? MCP_GRANT_SAVING : grantReceipt}
                </p>
              )}

              {/* A failure leaves the switch at the SERVER's old value — it never moved, so
                  there is nothing to roll back. */}
              {grantFailed && (
                <p
                  role="alert"
                  data-testid="mcp-grant-error"
                  className="text-[10px] leading-tight text-destructive"
                >
                  {MCP_GRANT_WRITE_FAILED}
                </p>
              )}

              {/* D-206.2-05, rendered PERMANENTLY beside the control — not on hover, not
                  behind a confirm, and never a `title`. It is what stops a governance write
                  reading as a preference toggle, and it is the honest mitigation for the
                  read-modify-write hazard the handler documents. */}
              <p
                data-testid="mcp-grant-scope-note"
                className="text-[10px] leading-tight text-muted-foreground"
              >
                {MCP_GRANT_SCOPE_NOTE}
              </p>
            </>
          )}

          {/* ⚠ THE SENTENCE IS THE SECOND FACT, NOT DECORATION. *This tool is not granted*
              and *you cannot grant it* are two facts, and leaving only the first strands a
              member in front of a badge with no way to read why nothing can be done. */}
          {grantsEnforced && audience === "member" && (
            <p
              data-testid="mcp-grant-admin-only"
              className="text-[10px] leading-tight text-muted-foreground"
            >
              {MCP_GRANT_ADMIN_ONLY_NOTE}
            </p>
          )}

          {selectedTool?.description && (
            <p
              data-testid="mcp-tool-description"
              className="text-[11px] text-muted-foreground"
            >
              {selectedTool.description}
            </p>
          )}

          {/* Tool Arguments Input */}
          <div className="flex flex-col gap-1">
            <Label
              htmlFor="mcp-tool-args"
              className="text-[11px] font-normal text-muted-foreground"
            >
              {MCP_TOOL_ARGS_LABEL}
            </Label>
            <Textarea
              id="mcp-tool-args"
              data-testid="mcp-tool-args"
              value={argsJsonString}
              disabled={disabled}
              placeholder='{ "key": "value" }'
              onChange={handleArgsChange}
              rows={3}
              className="font-mono text-[11px]"
            />
            {jsonError && (
              <p
                role="alert"
                data-testid="mcp-args-error"
                className="text-[10px] text-destructive"
              >
                {jsonError}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default McpToolPicker

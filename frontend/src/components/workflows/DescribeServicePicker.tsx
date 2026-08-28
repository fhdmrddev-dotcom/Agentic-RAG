/**
 * Phase 214-13 Task 1 (STEP-06 · D-214-20 · sketch 217 §1/§2) — DescribeServicePicker.
 *
 * THE ONE PLACE THE LOOSE DOOR CAN SAY WHICH SERVICES THIS WORKFLOW MAY USE, BEFORE THE
 * AI DRAFTS.
 *
 * ── Why this file exists ─────────────────────────────────────────────────────────────
 * SC#5's own words name the failure: *"an invented step that validates and fails at
 * 03:00."* Post-draft validation ALONE was rejected (sketch 217 §5) because it is a
 * MODEL-BEHAVIOUR guarantee — it depends on the model, or a checker, noticing afterwards.
 * The picker makes the failure structurally impossible instead: **the generator's
 * vocabulary IS the ticked set**, so a step naming an unconnected service cannot be
 * drafted rather than being caught after it was.
 *
 * ⚠ THE PICKER IS ONLY HALF OF THAT CLAIM, AND THE OTHER HALF IS NOT HERE. A vocabulary
 * handed to a prompt is still a prompt. `workflow_authoring.py` says so in its own words
 * (*"a prompt clause reduces how often the model composes such a step; it can never
 * guarantee absence"*), which is why the ticked set is ALSO enforced on the emitted
 * definition server-side. This component supplies the set; it does not enforce it.
 *
 * ── ⭐ THE GRANT GRAIN IS THE VOCABULARY GRAIN ────────────────────────────────────────
 * A service is tickable when at least one of its actions is GRANTED — effective posture
 * `allow` — never merely DISCOVERED. That is exactly why STEP-06's stated dependency is
 * Phase 213, and it is the reason `grantedActionsOf` below mirrors the server's
 * `resolve_effective_posture` (`backend/app/services/connectors/grants.py`) rather than
 * inventing a second answer: an explicit `tool_grants` key wins, an absent key INHERITS
 * `default_approval_posture` (whose floor is `ask`), and anything unrecognised fails
 * closed. A picker that read `discovered_tools` alone would offer the author a vocabulary
 * the executor will refuse at run time.
 *
 * ── It is a CONTROL, never a GATE (the `DescribeKbPicker` posture, copied) ────────────
 * Nothing about the door's CTA enablement passes through here. An author who ignores this
 * gets today's behaviour exactly: ticking nothing sends nothing, and an ABSENT
 * `allowed_connection_ids` is the server's unconstrained arm. The picker holds no
 * `required`, no `disabled` on the group, and no validity marking.
 *
 * ── ⛔ NO CREDENTIAL FIELD ON THIS DOOR (sketch 217 #6, D-214-21) ─────────────────────
 * A credential form on a drafting screen is a NEW OUTBOUND TRUST SURFACE with no prior
 * review cycle, and `SEED-156` already records that both authoring doors open onto the
 * same crowded first screen. The two next actions point AT Settings; they never embed it.
 * A `?raw` fence in the suite holds this file to zero credential-shaped inputs.
 *
 * ── A leaf: ONE api symbol, no store, no route (the `DescribeKbPicker` shape) ─────────
 * The component owns the request and the markup; the PARENT owns the choice. It reads
 * exactly one symbol from the api client and names no route, no store and no navigation
 * seam — asserted at the source with a positive control over every needle.
 *
 * ── Two ways to have zero rows, held APART ───────────────────────────────────────────
 * "There are none" and "we could not ask" are DIFFERENT FACTS (the StarterTemplatePicker
 * rule, followed here as `DescribeKbPicker` follows it). Both are distinct component
 * states, observable through one `hidden`/`aria-hidden` state marker that adds no surface
 * and nothing to the accessibility tree.
 */
import { useEffect, useState } from "react"

import { listConnectorConnections } from "@/lib/api"
import type { ConnectorConnection } from "@/lib/api"
import { ConnectionMarkGlyph } from "@/lib/connectionMark"
import {
  SERVICES_EMPTY,
  SERVICES_EMPTY_NEXT,
  SERVICES_HINT,
  SERVICES_LABEL,
  SERVICE_ACTIONS,
  SERVICE_NO_GRANTS,
  SERVICE_NO_GRANTS_NEXT,
} from "@/components/workflows/doorVocabulary"

/**
 * The `unavailable` arm's sentence — WE COULD NOT ASK.
 *
 * ⚠ IT LIVES HERE AND NOT IN `doorVocabulary.ts`, WHICH IS A DELIBERATE READING OF THAT
 * MODULE'S CONTRACT RATHER THAN AN EXEMPTION FROM IT. `doorVocabulary.test.ts` asserts that
 * the module's export set EQUALS the union of two generated contracts, so a thirteenth id
 * sketch 217 never drew would red that whole-table assertion — the very property the module
 * exists to hold. The shipped precedent is exact and one file over:
 * `DescribeKbPicker.DESCRIBE_KB_UNAVAILABLE`, whose own docblock records that sketch 200
 * drew three arms and this is a fourth, *"authored rather than ported"*.
 *
 * ⚠ AND IT MAY NOT BORROW `SERVICES_EMPTY`'s WORDS. A failed read knows nothing about how
 * many connections exist, so *"you have not connected anything yet"* here would be inventing
 * the server's answer — the same fabrication `DescribeKbPicker` holds these two facts apart
 * to prevent. No severity word, no verdict, no claim about drafting.
 */
export const SERVICES_UNAVAILABLE = "Your connections could not be loaded just now"

/**
 * Whether ONE action on a connection is granted, mirroring the server's D-213-06 rules.
 *
 * ⚠ IT IS NOT A SECOND SPELLING OF `isToolGranted` (`McpToolPicker.tsx:172`), WHICH IS
 * NARROWER ON PURPOSE. That predicate answers *"did a person tick this exact tool?"* for a
 * surface whose whole job is toggling explicit keys, so it deliberately does NOT inherit.
 * The question HERE is the executor's question — *"will gate 5.5 let this run?"* — and
 * gate 5.5 inherits (`grants.py:47-48`). Reusing the narrower predicate would under-report
 * a connection whose `default_approval_posture` is `allow`, and the author would be told
 * *"Nothing allowed yet"* about a service that is, in fact, allowed.
 *
 * The legacy boolean spelling is carried for the same reason the server carries it: a row
 * written before Phase 213 stores `true`/`false` rather than a posture string.
 */
export function actionIsGranted(
  connection: Pick<ConnectorConnection, "tool_grants" | "default_approval_posture">,
  action: string,
): boolean {
  const grants = connection.tool_grants ?? {}
  // `hasOwnProperty`, never a bare index: `tool_grants` is server data keyed by free text,
  // and `grants["constructor"]` reaches `Object.prototype` (the `own(MAP, key)` rule
  // `org.ts` records for `service_id`).
  if (Object.prototype.hasOwnProperty.call(grants, action)) {
    const value = grants[action]
    if (value === "allow" || value === true) return true
    // ⚠ EVERY OTHER EXPLICIT VALUE IS A REFUSAL, INCLUDING ONE THIS CLIENT DOES NOT
    // RECOGNISE. The server fails closed to `deny` on an unrecognised value; a client that
    // fell through to the inherited default here would offer a vocabulary the server denies.
    return false
  }
  return connection.default_approval_posture === "allow"
}

/**
 * Every action name this connection can currently perform, in a stable order.
 *
 * The candidate set is the union of the actions the connection ADVERTISES and the actions
 * a person has already spoken about explicitly:
 *   · an MCP connection advertises `discovered_tools[].name`;
 *   · a native connection advertises its single `capability` — gate 5.5's own
 *     `tool_name or capability` fallback (`phase_types.py:2554`), so both shapes are one
 *     question rather than two branches;
 *   · plus any explicit `tool_grants` key, because a grant for an action the server has
 *     stopped advertising is still a grant the executor will honour.
 */
export function grantedActionsOf(connection: ConnectorConnection): string[] {
  const candidates: string[] = []
  const push = (name: unknown) => {
    if (typeof name !== "string") return
    const trimmed = name.trim()
    if (trimmed.length === 0) return
    if (!candidates.includes(trimmed)) candidates.push(trimmed)
  }
  for (const tool of connection.discovered_tools ?? []) push(tool?.name)
  push(connection.capability)
  for (const key of Object.keys(connection.tool_grants ?? {})) push(key)
  return candidates.filter((action) => actionIsGranted(connection, action))
}

/** One offered row, already narrowed to what this surface renders. */
export interface ServiceOption {
  /** The `connector_connections` row id — the value that rides the wire. */
  id: string
  /** What the author called this connection. Never a slug. */
  label: string
  /** The free-text service identity, for the mark and for the refusal's catalog match. */
  serviceId: string
  /** The granted action names. EMPTY means present-but-not-selectable (#9). */
  grantedActions: string[]
  /** The whole row, for `ConnectionMarkGlyph` — which resolves its own mark (⛔ no re-map). */
  shape: ConnectorConnection
}

/**
 * What this component currently knows. FOUR states, because a request has four outcomes
 * and "we could not ask" is not "there are none" (the `DescribeKbPicker` rule).
 */
type PickerState = "loading" | "ready" | "none" | "unavailable"

export interface DescribeServicePickerProps {
  /** The ticked connection ids. The PARENT owns this — the component holds no copy, so
   *  there is no second source to drift from the one that is sent. */
  value: readonly string[]
  /** The author ticked or unticked. Always connection ids, never service names. */
  onChange: (ids: string[]) => void
  /** Placement only. The component owns its own layout inside this box. */
  className?: string
  /**
   * The way out of having nothing connected — offered where the author discovers it.
   *
   * ⚠ OPTIONAL, AND FOR THE `DescribeKbPicker.onUploadDocuments` REASON RATHER THAN A NEW
   * ONE: the app has no url router (`SEED-185`), so this component cannot reach Settings
   * on its own. ABSENT ⇒ both next actions render as STATEMENTS — the author still learns
   * where to go, which is the whole content of `SERVICES_EMPTY_NEXT` and
   * `SERVICE_NO_GRANTS_NEXT`. PRESENT ⇒ they become controls, wired to the destination
   * their OWNER knows. A control that looked like a way out and did nothing would be
   * worse than the sentence alone.
   */
  onOpenSettings?: () => void
}

export function DescribeServicePicker({
  value,
  onChange,
  className,
  onOpenSettings,
}: DescribeServicePickerProps) {
  const [state, setState] = useState<PickerState>("loading")
  const [options, setOptions] = useState<readonly ServiceOption[]>([])

  // ONE best-effort request on mount, in the `cancelled` idiom `DescribeKbPicker` uses. A
  // failure renders the honest "we could not ask" arm and never retries: this is a read
  // that costs a round trip and buys an optional convenience, and a retry loop on the
  // fastest path in the product would be a poor trade.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const connections = await listConnectorConnections()
        if (cancelled) return
        const rows: ServiceOption[] = []
        for (const c of connections ?? []) {
          const id = typeof c?.id === "string" ? c.id : ""
          // A row with no usable id cannot be ticked, so offering it would be offering a
          // dead option. Dropped rather than rendered as an untickable blank.
          if (id.trim().length === 0) continue
          const serviceId = typeof c?.service_id === "string" ? c.service_id.trim() : ""
          const name = typeof c?.name === "string" ? c.name.trim() : ""
          rows.push({
            id,
            // TOTALITY (the CANVAS-01 contract's shape): a nameless connection names
            // ITSELF. A blank chip is worse than a rough one — unreadable AND
            // unrecognisable.
            label: name.length > 0 ? name : serviceId.length > 0 ? serviceId : id,
            serviceId,
            grantedActions: grantedActionsOf(c),
            shape: c,
          })
        }
        setOptions(rows)
        setState(rows.length > 0 ? "ready" : "none")
      } catch {
        if (cancelled) return
        // NOTHING is invented here: no cached list, no remembered rows, no fabricated
        // connection. Zero rows, and a state that says WHY it is zero.
        setOptions([])
        setState("unavailable")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  /**
   * ── WHAT IS SENT IS ALWAYS SOMETHING THE AUTHOR CAN SEE (the CR-R5-01 rule) ─────────
   *
   * The parent keeps `value` across unmount (a considered pick is not undone by looking
   * around — the shipped `WorkflowDoorSwitch` rule for `kbFolderId`). Compose that with a
   * connection that is deleted, scoped away by RLS, or has had its last grant revoked, and
   * the door could put a connection id into the generator's vocabulary that no chip on
   * screen shows. That is not merely untidy: the vocabulary decides which services a
   * drafted workflow may act on, so an unofferable id would WIDEN it invisibly.
   *
   * So once the request has SETTLED, an unofferable tick is surrendered back to the
   * parent. It fails toward the NARROWER set, never toward a silent widening. `loading` is
   * excluded because "not asked yet" is not "not offered"; `unavailable` is INCLUDED for
   * the reason that matters here — when nothing renders, the author cannot see or change
   * what would be sent, whatever the reason for the emptiness.
   */
  useEffect(() => {
    if (state === "loading") return
    if (value.length === 0) return
    const offerable = new Set(options.filter((o) => o.grantedActions.length > 0).map((o) => o.id))
    const kept = value.filter((id) => offerable.has(id))
    if (kept.length === value.length) return
    onChange(kept)
  }, [state, options, value, onChange])

  // The state probe. `hidden` + `aria-hidden` — no surface, nothing in the accessibility
  // tree, and (being `display:none`) not a flex item, so an unoffered picker adds no gap to
  // the column it sits in. It exists so "there are none" and "we could not ask" are
  // distinguishable without either of them rendering a row.
  const stateMarker = (
    <span hidden aria-hidden="true" data-testid="describe-services-state" data-state={state} />
  )

  /**
   * The section frame, identical across arms so the label never jumps as the request
   * settles and the column's height does not shift under the author's cursor. A `div`
   * rather than a `label` element: most arms wrap no form control at all, and a `label`
   * around a button is a relationship the accessibility tree cannot make sense of.
   */
  const frame = (arm: React.ReactNode) => (
    <div
      data-testid="describe-services"
      className={["flex flex-col gap-2", className ?? ""].join(" ").trim()}
    >
      {stateMarker}
      <span className="font-mono text-[14px] leading-[1.4] text-foreground">{SERVICES_LABEL}</span>
      <div className="flex flex-col gap-2">{arm}</div>
    </div>
  )

  /**
   * A next action, which is a CONTROL only where a destination exists (`SEED-185`).
   *
   * ⚠ THE WORDS RENDER EITHER WAY, and that is invariant #10's actual requirement — the
   * empty picker STATES ITSELF AND OFFERS THE NEXT ACTION. Withholding the sentence when
   * no handler is wired would leave an author with nothing connected being told nothing at
   * all, which is the failure `DescribeKbPicker`'s silent third arm already cost once.
   */
  const nextAction = (testId: string, words: string) =>
    onOpenSettings ? (
      <button
        type="button"
        data-testid={testId}
        onClick={onOpenSettings}
        className="shrink-0 font-mono text-[12px] text-primary transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
      >
        {words}
      </button>
    ) : (
      <span data-testid={testId} className="shrink-0 font-mono text-[12px] text-primary">
        {words}
      </span>
    )

  // NOT ASKED YET. Neither "you have none" nor "we could not ask" is true here, so the
  // surface claims neither and the label does not flash a sentence it is about to replace.
  if (state === "loading") return stateMarker

  /**
   * ── WE COULD NOT ASK ────────────────────────────────────────────────────────────────
   * A failed read knows nothing about how many connections exist, so it may NOT borrow
   * `SERVICES_EMPTY`'s words — *"You have not connected anything yet"* would be inventing
   * the server's answer. `SERVICES_EMPTY_NEXT` is still offered: going to Settings is the
   * right next act whichever of the two facts is true.
   */
  if (state === "unavailable") {
    return frame(
      <div
        data-testid="describe-services-unavailable"
        className="flex w-full items-center justify-between gap-2 px-2 py-2 opacity-70"
      >
        <span className="text-[14px] leading-[1.5] text-muted-foreground">
          {SERVICES_UNAVAILABLE}
        </span>
        {nextAction("describe-services-unavailable-next", SERVICES_EMPTY_NEXT)}
      </div>,
    )
  }

  // ── NOTHING CONNECTED AT ALL (sketch 217 #10) — it states the world and offers the way
  //    out. It does not scold, and it does not disappear.
  if (state === "none" || options.length === 0) {
    return frame(
      <div
        data-testid="describe-services-empty"
        className="flex w-full items-center justify-between gap-2 px-2 py-2 opacity-70"
      >
        <span className="text-[14px] leading-[1.5] text-muted-foreground">{SERVICES_EMPTY}</span>
        {nextAction("describe-services-empty-next", SERVICES_EMPTY_NEXT)}
      </div>,
    )
  }

  const ticked = new Set(value)

  return frame(
    <>
      <div data-testid="describe-services-chips" className="flex flex-wrap gap-2">
        {options.map((o) => {
          const granted = o.grantedActions.length > 0
          const pressed = granted && ticked.has(o.id)
          return (
            <button
              key={o.id}
              type="button"
              data-testid={`describe-service-${o.id}`}
              data-service={o.serviceId}
              data-granted={granted ? "true" : "false"}
              // ⚠ EVERY CHIP DECLARES PRESSED · GRANTS · SERVICE (#8), AND AN UNGRANTED
              // CHIP IS NEVER PRE-SELECTED — `pressed` above ANDs on `granted`, so a stale
              // tick on a connection whose last grant was revoked cannot read as ticked
              // even for the one render before the surrender effect above runs.
              aria-pressed={pressed}
              // ⚠ `aria-disabled`, NEVER `disabled` (#9): an ungranted service is PRESENT,
              // NOT SELECTABLE, AND SAYS WHY. A `disabled` button is dropped from the tab
              // order by most browsers, so the one arm whose entire purpose is to be READ
              // would be the arm a keyboard author can never reach.
              aria-disabled={!granted}
              onClick={() => {
                // The click that does nothing, said once and structurally: an ungranted
                // service cannot enter the vocabulary, because the executor would refuse it.
                if (!granted) return
                onChange(pressed ? value.filter((id) => id !== o.id) : [...value, o.id])
              }}
              className={[
                "flex items-center gap-2 rounded border px-3 py-2 text-left text-[13px] leading-[1.4] transition-colors focus-visible:outline-none",
                granted
                  ? pressed
                    ? "border-primary bg-primary/10 text-foreground focus-visible:border-primary"
                    : "border-border bg-card text-foreground hover:border-primary focus-visible:border-primary"
                  : "cursor-not-allowed border-dashed border-border bg-background text-muted-foreground",
              ].join(" ")}
            >
              <ConnectionMarkGlyph shape={o.shape} size="chip" />
              <span className="flex flex-col">
                <span className="font-medium">{o.label}</span>
                {granted ? (
                  // ⚠ THE COUNT IS RENDERED BESIDE THE GOVERNED LABEL, NOT INSIDE IT (#13).
                  // `SERVICE_ACTIONS` is the words; the parenthesised number is the fact,
                  // and a vocabulary leaf may not carry a plural rule (D-12 — the hint's
                  // own precedent, where only the fragments are data).
                  <span data-testid={`describe-service-actions-${o.id}`} className="text-muted-foreground">
                    {SERVICE_ACTIONS({ service: o.label })} ({o.grantedActions.length})
                  </span>
                ) : (
                  <span className="flex flex-wrap items-baseline gap-1">
                    <span data-testid={`describe-service-nogrants-${o.id}`} className="text-muted-foreground">
                      {SERVICE_NO_GRANTS}
                    </span>
                    <span data-testid={`describe-service-nogrants-next-${o.id}`} className="text-primary">
                      {SERVICE_NO_GRANTS_NEXT}
                    </span>
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>
      <span
        data-testid="describe-services-hint"
        className="text-[11.5px] leading-snug text-muted-foreground"
      >
        {SERVICES_HINT}
      </span>
    </>,
  )
}

export default DescribeServicePicker

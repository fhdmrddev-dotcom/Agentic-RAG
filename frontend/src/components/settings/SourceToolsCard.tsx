/**
 * Phase 239-08 — THE G-5 EXTRACTION, and it is a MOVE, not a rewrite.
 *
 * `ConnectionFormPanel.tsx` measured `27 commits / 10 phases / 2807 lines` with its ledger row
 * STALE AT FOUR CONSECUTIVE CLOSES, and `239-07` recorded the extraction as OWED with this exact
 * seam named: the file-source binding card, ~330 of those lines, grown across `239-01..07`. It
 * reads `probeResult` and `draft` and writes ONLY through `set`, so there is NO STATE TO MOVE —
 * `probeResult` stays a `useState` in the panel and arrives here as a prop. Nothing below changed
 * except its indentation and the guard's shape.
 *
 * ⚠ THE WIDER SEAM `docs/HOT-FILE-LEDGER.md` NAMES — every per-shape field block →
 * `ConnectionShapeFields.tsx` — IS **NOT** DISCHARGED BY THIS FILE AND REMAINS OWED. This card
 * was taken first because it is the unit that actually grew the panel and it is self-contained;
 * taking it SHRINKS the `mcp` block, so the wider seam gets easier rather than competing.
 *
 * ── ⛔ THE `capability === "mcp"` FENCE TRAVELS WITH THE CARD, AND THAT IS THE POINT ──
 * In the panel it was a condition at ONE call site. Here it is a guard clause the component
 * itself owns, which is strictly stronger: a second call site cannot forget it.
 * `sources/base.CONFIG_PROTOCOL_MARKERS` resolves ANY connection whose config carries a
 * non-empty `source_tools` to `McpSourceAdapter` — so offering this on a Slack row would let a
 * person hand a first-party connection to the MCP adapter, which would then try to call a tool
 * over a server URL that does not exist.
 *
 * ⚠ `capability` IS THE PANEL'S LOCAL, DERIVED FROM `connection.mcp_server_url` — never
 * `draft.capability`. `ConnectionFormPanel.sourceTools.test.tsx` records that distinction as a
 * fact rather than an assumption; only the SAVE path consults the draft. Passing the panel's
 * local is what keeps the shipped edit-mode behaviour identical.
 *
 * ── ⛔ THIS COMPONENT AUTHORS NO SENTENCE OF ITS OWN ──
 * It inherits the panel's rule unchanged: every user-visible string below is an imported
 * identifier from `connectionFormCopy`. The `?raw` source fences that asserted this over
 * `ConnectionFormPanel.tsx` are EXTENDED to this file in the same commit — a fence asserting a
 * string is absent from the panel still passes once the string moves here, while the invariant
 * it protects has quietly left its scope. That is the single most likely way to get an
 * extraction like this wrong, so it is named here as well as asserted there.
 *
 * ── ⛔ ZERO `title` ATTRIBUTES ──
 * The panel's measured-`0` rule, inherited: a reason is real DOM text or it does not exist.
 * Asserted over THIS source too, not only over the panel's.
 */
import type { McpDiscoveredTool } from "@/lib/api"
import {
  SOURCE_ARGS_HEADING,
  SOURCE_ARGS_HELP,
  SOURCE_ARGS_NONE_NEEDED,
  SOURCE_ARGS_UNDESCRIBED,
  SOURCE_ARG_VALUE_MAX,
  SOURCE_PATH_ARG_HELP,
  SOURCE_PATH_ARG_LABEL,
  SOURCE_TOOLS_DEFAULT_LIST,
  SOURCE_TOOLS_DEFAULT_READ,
  SOURCE_TOOLS_HEADING,
  SOURCE_TOOLS_HELP,
  SOURCE_TOOLS_LIST_LABEL,
  SOURCE_TOOLS_READ_LABEL,
  SOURCE_TOOLS_ROOT_LABEL,
  SOURCE_TOOLS_ROOT_HELP,
  looksLikeSourceToolMutation,
  sourceArgRowNote,
  sourceArgsIncompleteNote,
  sourceArgsUnstorableNote,
  sourceArgumentModel,
  sourcePathArgUnsetLabel,
  sourceToolUnsetLabel,
  sourceToolsWithheldNote,
  type ConnectionDraft,
  type ConnectionShape,
} from "@/components/settings/connectionFormCopy"

export type SourceToolsCardProps = {
  /** The PANEL's local capability, derived from `connection.mcp_server_url`. */
  capability: ConnectionShape
  /** The discovery probe's result, owned by the panel. `null` before any probe. */
  probeResult: McpDiscoveredTool[] | null
  draft: ConnectionDraft
  set: (patch: Partial<ConnectionDraft>) => void
  /** The panel's `useId()`, so every control id here stays in the panel's namespace. */
  fieldId: string
  readOnly: boolean
}

export function SourceToolsCard({
  capability,
  probeResult,
  draft,
  set,
  fieldId,
  readOnly,
}: SourceToolsCardProps) {
  // ⛔ THE FENCE, AS A GUARD CLAUSE — see the docblock. Identical condition to the one this
  //    block carried at its single call site in `ConnectionFormPanel.tsx`, moved inside so it
  //    cannot be omitted by a future caller.
  if (capability !== "mcp" || !probeResult || probeResult.length === 0) return null

  return (
    <div
      data-testid="connection-source-tools"
      className="mb-3.5 rounded-lg border border-border bg-card/60 p-3"
    >
      <p className="text-xs font-semibold text-foreground">{SOURCE_TOOLS_HEADING}</p>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
        {SOURCE_TOOLS_HELP}
      </p>
      {/* ⚠ ABSENT WHEN NOTHING WAS WITHHELD, never a zero-count sentence. The count is
          over the DISCOVERED list, so it is the same on both slots and is said once. */}
      {probeResult.filter((t) => looksLikeSourceToolMutation(t.name)).length > 0 && (
        <p
          data-testid="connection-source-tools-withheld"
          className="mt-1.5 text-[11px] leading-snug text-muted-foreground"
        >
          {sourceToolsWithheldNote(
            probeResult.filter((t) => looksLikeSourceToolMutation(t.name)).length,
          )}
        </p>
      )}
      {(
        [
          {
            label: SOURCE_TOOLS_LIST_LABEL,
            slot: "list" as const,
            value: draft.sourceListTool,
            fallback: SOURCE_TOOLS_DEFAULT_LIST,
          },
          {
            label: SOURCE_TOOLS_READ_LABEL,
            slot: "read" as const,
            value: draft.sourceReadTool,
            fallback: SOURCE_TOOLS_DEFAULT_READ,
          },
        ]
      ).map(({ label, slot, value, fallback }) => {
        const controlId = `${fieldId}-source-${slot}`
        // ⛔ THE STORED VALUE IS ALWAYS OFFERED, EVEN WHEN IT WOULD BE WITHHELD, and
        // that is not a loophole — it is what stops the filter becoming a WIPE. A
        // `<select>` whose value is absent from its options renders as unselected, so
        // merely OPENING this panel and pressing Save would silently re-point a stored
        // binding: HI-02's defect, re-introduced by HI-02's neighbour's remedy. A person
        // sees what is actually bound and can change it; refusing to STORE it is the
        // boundary's job, where a refusal can be worded.
        const options = probeResult
          .map((tool) => tool.name)
          .filter((name) => !looksLikeSourceToolMutation(name) || name === value)
        return (
          <div key={slot} className="mt-2.5">
            <label
              htmlFor={controlId}
              className="mb-1 block text-[11px] font-medium text-foreground"
            >
              {label}
            </label>
            {readOnly ? (
              // A control that could never do anything is REMOVED, not `disabled` —
              // the shipped 185 rule this panel already follows for every other field.
              <div
                id={controlId}
                data-testid="connection-field-static"
                className="font-mono text-[11px] text-muted-foreground"
              >
                {value || sourceToolUnsetLabel(fallback)}
              </div>
            ) : (
              <select
                id={controlId}
                value={value}
                onChange={(e) =>
                  set(
                    slot === "list"
                      ? { sourceListTool: e.target.value }
                      : { sourceReadTool: e.target.value },
                  )
                }
                className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-[13px] text-foreground focus:border-primary focus:outline-none"
              >
                <option value="">{sourceToolUnsetLabel(fallback)}</option>
                {options.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )
      })}
      {/* ⛔ HI-04 — A FREE-TEXT PATH, NOT A PICKER, and that is not laziness: the server
          publishes its TOOLS, never its FOLDERS, so there is no list to offer. This is
          the one field on this card the product genuinely cannot guess.
          ⚠ It renders the STORED value, for HI-02's reason one field over: a control that
          shows blank over a stored value makes opening the panel and pressing Save a
          silent wipe. */}
      {(() => {
        const rootId = `${fieldId}-source-root`
        return (
          <div className="mt-2.5">
            <label
              htmlFor={rootId}
              className="mb-1 block text-[11px] font-medium text-foreground"
            >
              {SOURCE_TOOLS_ROOT_LABEL}
            </label>
            {readOnly ? (
              <div
                id={rootId}
                data-testid="connection-field-static"
                className="font-mono text-[11px] text-muted-foreground"
              >
                {draft.sourceRootPath || "—"}
              </div>
            ) : (
              <input
                id={rootId}
                type="text"
                value={draft.sourceRootPath}
                onChange={(e) => set({ sourceRootPath: e.target.value })}
                placeholder="/srv/docs"
                spellCheck={false}
                className="w-full rounded-md border border-border bg-card px-2 py-1.5 font-mono text-[13px] text-foreground focus:border-primary focus:outline-none"
              />
            )}
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
              {SOURCE_TOOLS_ROOT_HELP}
            </p>
          </div>
        )
      })()}

      {/* ── SEED-259 — WHICH ARGUMENTS THIS SERVER NEEDS ──────────────────────────
           ⭐ THE HALF THAT WAS CODE. Phase 239 made a tool's NAME a row and left its
           ARGUMENT SHAPE in the adapter, which always sent a lone `path`. Driven live,
           a server whose reader takes three arguments answered `HTTP 200` with an EMPTY
           LISTING — and an empty-but-complete listing is exactly what the `H-5` deletion
           guard consumes. `239-06` made the shape a row and made the underspecified call
           a REFUSAL BY NAME; this block is the only place a person can supply it.

           ⛔ NO SERVER IS NAMED AND NO ARGUMENT IS DEFAULTED. Every row below is derived
           from the server's own `inputSchema`, already discovered and already stored. A
           second server needs rows here, never a branch — which is the whole ruling.

           ⚠ THE STORED VALUE IS ALWAYS RENDERED, in both controls. A control that shows
           blank over a stored value turns "open the panel and press Save" into a silent
           wipe (HI-02), and `configFromDraft` rewrites this column WHOLE. */}
      {(() => {
        const args = sourceArgumentModel(probeResult, draft)
        const pathId = `${fieldId}-source-path-arg`
        // ⛔ THE STORED VALUE IS OFFERED EVEN WHEN THE SCHEMA DOES NOT DECLARE IT. A
        // `<select>` whose value is absent from its options renders as UNSELECTED.
        const stored = draft.sourcePathArg.trim()
        const pathOptions = stored && !args.declared.includes(stored)
          ? [...args.declared, stored]
          : args.declared
        return (
          <div
            data-testid="connection-source-args"
            className="mt-3 border-t border-border/60 pt-2.5"
          >
            <p className="text-[11px] font-semibold text-foreground">
              {SOURCE_ARGS_HEADING}
            </p>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
              {SOURCE_ARGS_HELP}
            </p>

            <div className="mt-2.5">
              <label
                htmlFor={pathId}
                className="mb-1 block text-[11px] font-medium text-foreground"
              >
                {SOURCE_PATH_ARG_LABEL}
              </label>
              {readOnly ? (
                <div
                  id={pathId}
                  data-testid="connection-field-static"
                  className="font-mono text-[11px] text-muted-foreground"
                >
                  {draft.sourcePathArg || sourcePathArgUnsetLabel()}
                </div>
              ) : args.declared.length > 0 ? (
                // ⚠ THE BRANCH IS ON WHAT THE SERVER DECLARED, NOT ON HOW MANY OPTIONS
                // WOULD RESULT. A stored value is always ADDED to the options — but it
                // must never be the thing that manufactures a picker, or a server that
                // published no schema would offer a one-option `<select>` containing the
                // person's own previous answer and nothing else: a control that looks
                // like a choice and is a dead end.
                // ⭐ THE PRODUCT ALREADY KNOWS THESE NAMES, so it offers them. Asking a
                // person to retype one is how a typo pins every read to one fixed place.
                <select
                  id={pathId}
                  value={draft.sourcePathArg}
                  onChange={(e) => set({ sourcePathArg: e.target.value })}
                  className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-[13px] text-foreground focus:border-primary focus:outline-none"
                >
                  <option value="">{sourcePathArgUnsetLabel()}</option>
                  {pathOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              ) : (
                // ⚠ FREE TEXT ONLY WHERE NOTHING IS KNOWABLE — a `<select>` with one
                // option would TRAP a person on a server that published no schema. The
                // control follows the evidence rather than the other way round.
                <input
                  id={pathId}
                  type="text"
                  value={draft.sourcePathArg}
                  onChange={(e) => set({ sourcePathArg: e.target.value })}
                  maxLength={SOURCE_ARG_VALUE_MAX}
                  spellCheck={false}
                  className="w-full rounded-md border border-border bg-card px-2 py-1.5 font-mono text-[13px] text-foreground focus:border-primary focus:outline-none"
                />
              )}
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                {SOURCE_PATH_ARG_HELP}
              </p>
            </div>

            {args.rows.map((row, index) => {
              const rowId = `${fieldId}-source-arg-${index}`
              return (
                <div
                  key={row.name}
                  data-testid="connection-source-arg-row"
                  className="mt-2.5"
                >
                  <label
                    htmlFor={rowId}
                    className="mb-1 block text-[11px] font-medium text-foreground"
                  >
                    {/* The server's own name, VERBATIM — never prettified. A renamed
                        argument is a different argument. */}
                    <span data-testid="connection-source-arg-name" className="font-mono">
                      {row.name}
                    </span>
                  </label>
                  {readOnly ? (
                    <div
                      id={rowId}
                      data-testid="connection-field-static"
                      className="font-mono text-[11px] text-muted-foreground"
                    >
                      {row.value || "—"}
                    </div>
                  ) : (
                    <input
                      id={rowId}
                      type="text"
                      value={row.value}
                      onChange={(e) =>
                        set({
                          // ⛔ A NEW OBJECT EVERY TIME. `EMPTY_DRAFT` is spread, not
                          // deep-cloned, so mutating in place would edit the shared
                          // default and leak this mapping into the next form opened.
                          sourceStaticArgs: {
                            ...draft.sourceStaticArgs,
                            [row.name]: e.target.value,
                          },
                        })
                      }
                      maxLength={SOURCE_ARG_VALUE_MAX}
                      spellCheck={false}
                      className="w-full rounded-md border border-border bg-card px-2 py-1.5 font-mono text-[13px] text-foreground focus:border-primary focus:outline-none"
                    />
                  )}
                  <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                    {sourceArgRowNote(row.required)}
                  </p>
                </div>
              )
            })}

            {/* ⚠ TWO DIFFERENT FACTS. "asks for nothing else" is about the SERVER;
                "has not said" is about what we hold. Only one of them is ever true. */}
            {args.rows.length === 0 && args.unstorable.length === 0 && (
              <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
                {args.described ? SOURCE_ARGS_NONE_NEEDED : SOURCE_ARGS_UNDESCRIBED}
              </p>
            )}

            {args.missing.length > 0 && (
              <p
                data-testid="connection-source-args-incomplete"
                className="mt-2 text-[11px] leading-snug text-amber-700 dark:text-amber-300"
              >
                {sourceArgsIncompleteNote(args.missing)}
              </p>
            )}

            {args.unstorable.length > 0 && (
              <p
                data-testid="connection-source-args-unstorable"
                className="mt-2 text-[11px] leading-snug text-muted-foreground"
              >
                {sourceArgsUnstorableNote(args.unstorable)}
              </p>
            )}
          </div>
        )
      })()}
    </div>
  )
}
